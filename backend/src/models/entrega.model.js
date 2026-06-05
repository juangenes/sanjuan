const db = require('../config/db');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('crypto');

async function registrar(idpedido, items, operador) {
  const idot = require('crypto').randomUUID();
  const stmt = `INSERT INTO pedidos_entregas (idpedido, idproducto, cantidad, idot, operador)
                VALUES (?, ?, ?, ?, ?)`;
  for (const item of items) {
    await db.query(stmt, [idpedido, item.idproducto, item.cantidad, idot, operador || null]);
  }
  return idot;
}

// Registra una entrega RE-CHEQUEANDO el saldo dentro de una transacción con lock,
// para que dos terminales que disparan el mismo pedido a la vez no entreguen de
// más (TOCTOU). El `SELECT ... FOR UPDATE` sobre la fila del pedido serializa
// todos los retiros concurrentes de ESE pedido: la segunda transacción se bloquea
// hasta que la primera confirma, y recién ahí lee el saldo actualizado. Lockeamos
// la fila padre (pedidos) y no las de entregas para cubrir también los productos
// sin entregas previas (no habría filas que lockear → race de fantasmas).
async function registrarConSaldo(idpedido, items, operador) {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const [lock] = await conn.query(
      'SELECT idpedido FROM pedidos WHERE idpedido = ? FOR UPDATE',
      [idpedido]
    );
    if (!lock.length) throw new Error('Pedido no encontrado');

    // Saldo fresco leído DENTRO del lock: lo pedido (con título) y lo ya entregado.
    const [pedidos] = await conn.query(
      `SELECT pp.idproducto, pp.cantidad, p.titulo
       FROM pedidos_productos pp JOIN productos p ON pp.idproducto = p.idproducto
       WHERE pp.idpedido = ?`,
      [idpedido]
    );
    const [entregado] = await conn.query(
      `SELECT idproducto, SUM(cantidad) AS entregado FROM pedidos_entregas
       WHERE idpedido = ? GROUP BY idproducto`,
      [idpedido]
    );

    const pedidoMap = {};
    for (const p of pedidos) pedidoMap[p.idproducto] = p;
    const entregadoMap = {};
    for (const e of entregado) entregadoMap[e.idproducto] = Number(e.entregado);

    for (const item of items) {
      const ped = pedidoMap[item.idproducto];
      if (!ped) throw new Error(`Producto ${item.idproducto} no pertenece al pedido`);
      const ya = entregadoMap[item.idproducto] || 0;
      if (ya + item.cantidad > ped.cantidad) {
        const restante = Math.max(ped.cantidad - ya, 0);
        throw new Error(
          `Ya no queda saldo para "${ped.titulo}" (quedan ${restante}). Refrescá y volvé a intentar.`
        );
      }
    }

    const idot = require('crypto').randomUUID();
    const stmt = `INSERT INTO pedidos_entregas (idpedido, idproducto, cantidad, idot, operador)
                  VALUES (?, ?, ?, ?, ?)`;
    for (const item of items) {
      await conn.query(stmt, [idpedido, item.idproducto, item.cantidad, idot, operador || null]);
    }

    await conn.commit();
    return idot;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function obtenerEntregasPorPedido(idpedido) {
  const [rows] = await db.query(
    `SELECT pe.idproducto, p.titulo, SUM(pe.cantidad) AS entregado
     FROM pedidos_entregas pe
     JOIN productos p ON pe.idproducto = p.idproducto
     WHERE pe.idpedido = ?
     GROUP BY pe.idproducto`,
    [idpedido]
  );
  return rows;
}

async function obtenerBoleta(idpedido, idot) {
  const [rows] = await db.query(
    `SELECT pe.idproducto, p.titulo, pe.cantidad, pe.fecha
     FROM pedidos_entregas pe
     JOIN productos p ON pe.idproducto = p.idproducto
     WHERE pe.idpedido = ? AND pe.idot = ?`,
    [idpedido, idot]
  );
  return rows;
}

async function historialBoletas(idpedido) {
  const [rows] = await db.query(
    `SELECT idot, MIN(fecha) AS fecha FROM pedidos_entregas
     WHERE idpedido = ? AND idot IS NOT NULL
     GROUP BY idot ORDER BY fecha ASC`,
    [idpedido]
  );
  return rows;
}

async function retirosPorPedido(idpedido) {
  // `numero` = id de la comanda en RETIRO (el #XX que se canta), unido por idot.
  // LEFT JOIN porque retiros viejos podrían no tener comanda asociada. Las columnas
  // idot tienen colaciones distintas (pedidos_entregas=general_ci, expendio_envios=
  // unicode_ci); forzamos una común en el JOIN para evitar "illegal mix of collations".
  const [rows] = await db.query(
    `SELECT pe.idot, ee.id AS numero, pe.fecha, p.titulo, pe.cantidad, pp.precio_unitario
     FROM pedidos_entregas pe
     JOIN productos p ON pe.idproducto = p.idproducto
     JOIN pedidos_productos pp ON pp.idproducto = pe.idproducto AND pp.idpedido = pe.idpedido
     LEFT JOIN expendio_envios ee ON ee.idot COLLATE utf8mb4_general_ci = pe.idot
     WHERE pe.idpedido = ?
     ORDER BY pe.fecha ASC, pe.id ASC`,
    [idpedido]
  );
  return rows;
}

module.exports = { registrar, registrarConSaldo, obtenerEntregasPorPedido, obtenerBoleta, historialBoletas, retirosPorPedido };
