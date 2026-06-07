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

// ¿El pedido tiene líneas de JUEGO con créditos? Lo usan los puntos de cobro (caja
// QR / Bancard) para decidir si avisar al acreditador por realtime cuando el pedido
// queda PAGADO, sin recalcular toda la cola de pendientes.
async function pedidoTieneJuego(idpedido) {
  const [[row]] = await db.query(`
    SELECT 1 AS hay
    FROM pedidos_productos pp
    JOIN productos pr ON pr.idproducto = pp.idproducto
    WHERE pp.idpedido = ? AND pr.categoria = 'JUEGO' AND pr.creditos_por_unidad > 0
    LIMIT 1
  `, [idpedido]);
  return !!row;
}

// Reporte admin — créditos consumidos por puesto (ranking por ingresos). Cada
// fila de tarjeta_debito es UN crédito gastado en un puesto; agrupamos contando
// créditos y sumando su valor en guaraníes. LEFT JOIN desde puestos para que un
// stand sin consumo igual aparezca en cero (foto completa de todos los puestos).
async function consumoPorPuesto() {
  const [rows] = await db.query(`
    SELECT pu.id AS idpuesto, pu.codigo, pu.nombre,
           COUNT(td.id)                        AS creditos,
           COALESCE(SUM(td.valor_unitario), 0) AS valor
    FROM puestos pu
    LEFT JOIN tarjeta_debito td ON td.idpuesto = pu.id
    GROUP BY pu.id, pu.codigo, pu.nombre
    ORDER BY valor DESC, creditos DESC, pu.nombre ASC
  `);
  return rows;
}

// Reporte admin — detalle de consumos de UN puesto (cada crédito gastado),
// del más reciente al más viejo. Trae el código de tarjeta que lo consumió.
// `fecha` se devuelve como instante UTC (mysql2 timezone:'Z'); el front la
// muestra en hora de Asunción.
async function consumoDetallePuesto(idpuesto) {
  const [[puesto]] = await db.query(
    'SELECT id AS idpuesto, codigo, nombre FROM puestos WHERE id = ?', [idpuesto]
  );
  if (!puesto) return null;
  const [consumos] = await db.query(`
    SELECT td.id, td.fecha, td.valor_unitario, t.codigo AS tarjeta
    FROM tarjeta_debito td
    JOIN tarjetas t ON t.id = td.idtarjeta
    WHERE td.idpuesto = ?
    ORDER BY td.fecha DESC, td.id DESC
  `, [idpuesto]);
  const totales = consumos.reduce(
    (a, c) => ({ creditos: a.creditos + 1, valor: a.valor + Number(c.valor_unitario) }),
    { creditos: 0, valor: 0 }
  );
  return { puesto, consumos, totales };
}

// Reporte admin — cuadre de acreditación: créditos cargados vs consumidos y el
// saldo NO consumido, valuado por el valor_unitario de cada carga (hay precios
// distintos: preventa vs normal). El saldo por carga = cantidad − consumos que
// la referencian (FIFO ya dejó cada consumo atado a su carga via idtarjeta_credito).
async function cuadreAcreditacion() {
  // Subquery común: consumos por carga.
  const consumosPorCarga = `
    LEFT JOIN (SELECT idtarjeta_credito, COUNT(*) n FROM tarjeta_debito GROUP BY idtarjeta_credito) c
      ON c.idtarjeta_credito = tc.id`;

  const [[totales]] = await db.query(`
    SELECT
      SUM(tc.cantidad)                                            AS cargados,
      SUM(COALESCE(c.n,0))                                        AS consumidos,
      SUM(tc.cantidad - COALESCE(c.n,0))                          AS no_consumidos,
      SUM(tc.cantidad * tc.valor_unitario)                       AS gs_cargado,
      SUM(COALESCE(c.n,0) * tc.valor_unitario)                   AS gs_consumido,
      SUM((tc.cantidad - COALESCE(c.n,0)) * tc.valor_unitario)   AS gs_no_consumido
    FROM tarjeta_credito tc ${consumosPorCarga}
  `);

  const [porValor] = await db.query(`
    SELECT tc.valor_unitario,
      SUM(tc.cantidad)                                          AS cargados,
      SUM(COALESCE(c.n,0))                                      AS consumidos,
      SUM(tc.cantidad - COALESCE(c.n,0))                        AS no_consumidos,
      SUM((tc.cantidad - COALESCE(c.n,0)) * tc.valor_unitario) AS gs_no_consumido
    FROM tarjeta_credito tc ${consumosPorCarga}
    GROUP BY tc.valor_unitario
    ORDER BY tc.valor_unitario
  `);

  const [tarjetas] = await db.query(`
    SELECT t.codigo,
      SUM(tc.cantidad - COALESCE(c.n,0))                        AS saldo,
      SUM((tc.cantidad - COALESCE(c.n,0)) * tc.valor_unitario) AS saldo_gs
    FROM tarjeta_credito tc
    JOIN tarjetas t ON t.id = tc.idtarjeta ${consumosPorCarga}
    GROUP BY t.id, t.codigo
    HAVING saldo > 0
    ORDER BY saldo_gs DESC, saldo DESC
  `);

  return { totales, porValor, tarjetas };
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

module.exports = { buscarPorCodigo, cargar, saldo, consumir, movimientos, consumoPorPuesto, consumoDetallePuesto, cuadreAcreditacion, pedidosConCreditosPendientes, dispensar, pedidoTieneJuego };
