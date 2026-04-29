const db = require('../config/db');

async function crear(datos, conn) {
  const { cedula, familia, contacto, total } = datos;
  const [result] = await (conn || db).query(
    `INSERT INTO pedidos (cedula, familia, contacto, total, hash, estado)
     VALUES (?, ?, ?, ?, '', 'PENDIENTE')`,
    [cedula, familia, contacto, total]
  );
  return result.insertId;
}

async function obtenerFecha(idpedido, conn) {
  const [rows] = await (conn || db).query(
    'SELECT fecha FROM pedidos WHERE idpedido = ?', [idpedido]
  );
  return rows[0]?.fecha || null;
}

async function actualizarHash(idpedido, hash, conn) {
  await (conn || db).query(
    'UPDATE pedidos SET hash = ? WHERE idpedido = ?', [hash, idpedido]
  );
}

async function listarTodos() {
  const [rows] = await db.query(
    `SELECT idpedido, hash, fecha, cedula, familia, contacto, total, estado
     FROM pedidos ORDER BY idpedido DESC`
  );
  return rows;
}

async function buscarPorHash(hash) {
  const [rows] = await db.query(
    'SELECT * FROM pedidos WHERE hash = ?', [hash]
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const [rows] = await db.query(
    'SELECT * FROM pedidos WHERE idpedido = ?', [id]
  );
  return rows[0] || null;
}

async function marcarPagado(id) {
  await db.query("UPDATE pedidos SET estado = 'PAGADO' WHERE idpedido = ?", [id]);
}

async function resumenDashboard() {
  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS total_pedidos,
      SUM(CASE WHEN estado = 'PAGADO' THEN 1 ELSE 0 END) AS pagados,
      SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN estado = 'PAGADO' THEN total ELSE 0 END) AS monto_pagado,
      SUM(CASE WHEN estado = 'PENDIENTE' THEN total ELSE 0 END) AS monto_pendiente
    FROM pedidos
  `);
  return rows[0];
}

async function resumenPorProducto() {
  const [rows] = await db.query(`
    SELECT p.titulo AS producto, p.categoria,
      SUM(CASE WHEN ped.estado = 'PAGADO' THEN pp.cantidad ELSE 0 END) AS pagado,
      SUM(CASE WHEN ped.estado = 'PENDIENTE' THEN pp.cantidad ELSE 0 END) AS pendiente
    FROM pedidos_productos pp
    JOIN productos p ON pp.idproducto = p.idproducto
    JOIN pedidos ped ON pp.idpedido = ped.idpedido
    GROUP BY pp.idproducto
    ORDER BY p.categoria, p.titulo
  `);
  return rows;
}

module.exports = { crear, obtenerFecha, actualizarHash, listarTodos, buscarPorHash, buscarPorId, marcarPagado, resumenDashboard, resumenPorProducto };
