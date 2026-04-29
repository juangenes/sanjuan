const db = require('../config/db');

async function insertarItems(idpedido, items, conn) {
  const stmt = `INSERT INTO pedidos_productos (idpedido, idproducto, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)`;
  for (const item of items) {
    await (conn || db).query(stmt, [
      idpedido,
      item.idproducto,
      item.cantidad,
      item.precio_unitario,
      item.subtotal,
    ]);
  }
}

async function obtenerPorPedido(idpedido) {
  const [rows] = await db.query(
    `SELECT pp.*, p.titulo, p.imagen, p.categoria
     FROM pedidos_productos pp
     JOIN productos p ON pp.idproducto = p.idproducto
     WHERE pp.idpedido = ?`,
    [idpedido]
  );
  return rows;
}

module.exports = { insertarItems, obtenerPorPedido };
