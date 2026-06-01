const db = require('../config/db');

async function buscarPorCodigo(codigo) {
  const [rows] = await db.query(
    'SELECT * FROM tarjetas WHERE codigo = ?', [codigo]
  );
  return rows[0] || null;
}

async function cargar(idtarjeta, cantidad, valor_unitario, operador) {
  const [result] = await db.query(
    `INSERT INTO tarjeta_credito (idtarjeta, cantidad, valor_unitario, operador)
     VALUES (?, ?, ?, ?)`,
    [idtarjeta, cantidad, valor_unitario, operador]
  );
  return result.insertId;
}

async function saldo(idtarjeta) {
  const [cred] = await db.query(
    'SELECT COALESCE(SUM(cantidad), 0) AS total FROM tarjeta_credito WHERE idtarjeta = ?',
    [idtarjeta]
  );
  const [deb] = await db.query(
    'SELECT COALESCE(SUM(1), 0) AS total FROM tarjeta_debito WHERE idtarjeta = ?',
    [idtarjeta]
  );
  return Number(cred[0].total) - Number(deb[0].total);
}

async function consumir(idtarjeta, idpuesto) {
  // FIFO: tomar el crédito más antiguo no consumido
  const [creditos] = await db.query(
    `SELECT tc.id, tc.valor_unitario
     FROM tarjeta_credito tc
     WHERE tc.idtarjeta = ?
       AND (SELECT COUNT(*) FROM tarjeta_debito td WHERE td.idtarjeta_credito = tc.id) < tc.cantidad
     ORDER BY tc.fecha ASC, tc.id ASC
     LIMIT 1`,
    [idtarjeta]
  );
  if (!creditos.length) throw new Error('Sin saldo disponible');
  const credito = creditos[0];
  await db.query(
    `INSERT INTO tarjeta_debito (idtarjeta, idtarjeta_credito, idpuesto, valor_unitario)
     VALUES (?, ?, ?, ?)`,
    [idtarjeta, credito.id, idpuesto, credito.valor_unitario]
  );
  return credito.valor_unitario;
}

// Pedidos PAGADOS con créditos de juego pendientes de acreditar. Es el listado
// que ve el acreditador en el celular: por cada pedido, cuántos créditos compró
// (Σ cantidad × creditos_por_unidad de sus líneas JUEGO) menos los ya cargados.
async function pedidosConCreditosPendientes() {
  const [rows] = await db.query(`
    SELECT p.idpedido, p.hash, p.familia, p.fecha,
           SUM(pp.cantidad * pr.creditos_por_unidad) AS comprados,
           COALESCE((
             SELECT SUM(tc.cantidad) FROM tarjeta_credito tc
             WHERE tc.idpedido = p.idpedido
           ), 0) AS cargados
    FROM pedidos p
    JOIN pedidos_productos pp ON pp.idpedido = p.idpedido
    JOIN productos pr ON pr.idproducto = pp.idproducto
                     AND pr.categoria = 'JUEGO' AND pr.creditos_por_unidad > 0
    WHERE p.estado = 'PAGADO'
    GROUP BY p.idpedido, p.hash, p.familia, p.fecha
    ORDER BY p.fecha DESC
  `);
  return rows
    .map(r => {
      const comprados = Number(r.comprados);
      const cargados = Number(r.cargados);
      return {
        idpedido: r.idpedido,
        hash: r.hash,
        codigo: String(r.hash).substring(0, 8).toUpperCase(),
        familia: r.familia,
        fecha: r.fecha,
        comprados,
        cargados,
        pendiente: comprados - cargados,
      };
    })
    .filter(p => p.pendiente > 0);
}

// Dispensa `cantidad` créditos de un pedido PAGADO a una tarjeta física.
// Reparte los créditos entre las líneas JUEGO del pedido (FIFO de líneas), y
// cada chunk hereda el valor por crédito de su línea (precio_unitario ÷
// creditos_por_unidad) para que el cuadre sea exacto aun con precios mezclados.
// Soporta cargar el mismo pedido en varias tarjetas (parciales): valida contra
// lo que falta, no contra el total.
async function dispensar(hash, codigoTarjeta, cantidad, operador) {
  const n = parseInt(cantidad, 10);
  if (!n || n < 1) throw new Error('Cantidad inválida');

  const conn = await db.getConnection();
  await conn.beginTransaction();
  let tarjetaId;
  let pendienteRestante;
  try {
    const [[pedido]] = await conn.query(
      'SELECT idpedido, estado FROM pedidos WHERE hash = ?', [hash]
    );
    if (!pedido) throw new Error('Pedido no encontrado');
    if (pedido.estado !== 'PAGADO') throw new Error('El pedido no está pagado');

    const [[tarjeta]] = await conn.query(
      'SELECT id FROM tarjetas WHERE codigo = ?', [codigoTarjeta]
    );
    if (!tarjeta) throw new Error('Tarjeta no encontrada');
    tarjetaId = tarjeta.id;

    // Líneas de juego con lo ya cargado por línea. FOR UPDATE evita que dos
    // acreditadores dispensen el mismo crédito a la vez sobre el mismo pedido.
    const [lineas] = await conn.query(`
      SELECT pp.id AS idpp, pp.precio_unitario, pr.creditos_por_unidad,
             (pp.cantidad * pr.creditos_por_unidad) AS creditos_linea,
             COALESCE((
               SELECT SUM(tc.cantidad) FROM tarjeta_credito tc
               WHERE tc.idpedido_producto = pp.id
             ), 0) AS cargados_linea
      FROM pedidos_productos pp
      JOIN productos pr ON pr.idproducto = pp.idproducto
      WHERE pp.idpedido = ? AND pr.categoria = 'JUEGO' AND pr.creditos_por_unidad > 0
      ORDER BY pp.id ASC
      FOR UPDATE
    `, [pedido.idpedido]);

    const pendienteTotal = lineas.reduce(
      (a, l) => a + (Number(l.creditos_linea) - Number(l.cargados_linea)), 0
    );
    if (pendienteTotal <= 0) throw new Error('Este pedido ya tiene todos sus créditos acreditados');
    if (n > pendienteTotal) {
      throw new Error(`Solo quedan ${pendienteTotal} crédito${pendienteTotal !== 1 ? 's' : ''} por acreditar en este pedido`);
    }

    let restante = n;
    for (const l of lineas) {
      if (restante <= 0) break;
      const disponible = Number(l.creditos_linea) - Number(l.cargados_linea);
      if (disponible <= 0) continue;
      const chunk = Math.min(disponible, restante);
      const valorCredito = Math.round(Number(l.precio_unitario) / Number(l.creditos_por_unidad));
      await conn.query(
        `INSERT INTO tarjeta_credito
           (idtarjeta, cantidad, valor_unitario, operador, idpedido, idpedido_producto)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tarjetaId, chunk, valorCredito, operador, pedido.idpedido, l.idpp]
      );
      restante -= chunk;
    }

    pendienteRestante = pendienteTotal - n;
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const saldoTarjeta = await saldo(tarjetaId);
  return { saldoTarjeta, pendiente: pendienteRestante };
}

async function movimientos(idtarjeta) {
  const [rows] = await db.query(
    `SELECT 'CARGA' AS tipo, tc.cantidad, tc.valor_unitario, tc.fecha, tc.operador, NULL AS puesto
     FROM tarjeta_credito tc WHERE tc.idtarjeta = ?
     UNION ALL
     SELECT 'CONSUMO', 1, td.valor_unitario, td.fecha, NULL, p.nombre
     FROM tarjeta_debito td
     JOIN puestos p ON td.idpuesto = p.id
     WHERE td.idtarjeta = ?
     ORDER BY fecha DESC`,
    [idtarjeta, idtarjeta]
  );
  return rows;
}

module.exports = { buscarPorCodigo, cargar, saldo, consumir, movimientos, pedidosConCreditosPendientes, dispensar };
