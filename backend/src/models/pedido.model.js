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

async function listarPagados() {
  const [rows] = await db.query(
    `SELECT p.idpedido, p.hash, p.fecha, p.cedula, p.familia, p.total,
            COALESCE(SUM(pp.cantidad), 0) AS total_items,
            COALESCE(SUM(ent.entregado), 0) AS total_entregado
     FROM pedidos p
     LEFT JOIN pedidos_productos pp ON pp.idpedido = p.idpedido
     LEFT JOIN (
       SELECT idpedido, idproducto, SUM(cantidad) AS entregado
       FROM pedidos_entregas
       GROUP BY idpedido, idproducto
     ) ent ON ent.idpedido = pp.idpedido AND ent.idproducto = pp.idproducto
     WHERE p.estado = 'PAGADO'
     GROUP BY p.idpedido
     ORDER BY p.fecha DESC`
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

async function ventasPorProductoDetalle({ desde, hasta } = {}) {
  const where = ["ped.estado = 'PAGADO'"];
  const params = [];
  if (desde) { where.push('ped.fecha >= ?'); params.push(`${desde} 00:00:00`); }
  if (hasta) { where.push('ped.fecha <= ?'); params.push(`${hasta} 23:59:59`); }
  const whereSql = where.join(' AND ');

  const [productos] = await db.query(`
    SELECT
      p.idproducto,
      p.titulo                         AS producto,
      p.categoria,
      p.stock,
      p.precio_normal,
      COALESCE(SUM(pp.cantidad), 0)    AS unidades,
      COUNT(DISTINCT pp.idpedido)      AS pedidos,
      COUNT(DISTINCT ped.cedula)       AS familias,
      COALESCE(SUM(pp.subtotal), 0)    AS ingresos,
      COALESCE(SUM(ent.entregado), 0)  AS entregadas,
      MIN(ped.fecha)                   AS primera_venta,
      MAX(ped.fecha)                   AS ultima_venta
    FROM productos p
    LEFT JOIN pedidos_productos pp ON pp.idproducto = p.idproducto
    LEFT JOIN pedidos ped ON ped.idpedido = pp.idpedido AND ${whereSql}
    LEFT JOIN (
      SELECT idpedido, idproducto, SUM(cantidad) AS entregado
      FROM pedidos_entregas
      GROUP BY idpedido, idproducto
    ) ent ON ent.idpedido = pp.idpedido AND ent.idproducto = pp.idproducto
    GROUP BY p.idproducto
    ORDER BY ingresos DESC, p.titulo
  `, params);

  const [[totales]] = await db.query(`
    SELECT
      COUNT(DISTINCT ped.idpedido)      AS pedidos,
      COUNT(DISTINCT ped.cedula)        AS familias,
      COALESCE(SUM(ped.total), 0)       AS monto,
      COALESCE(SUM(pp.cantidad), 0)     AS unidades,
      COUNT(DISTINCT pp.idproducto)     AS productos_distintos
    FROM pedidos ped
    LEFT JOIN pedidos_productos pp ON pp.idpedido = ped.idpedido
    WHERE ${whereSql}
  `, params);

  return { productos, totales };
}

module.exports = { crear, obtenerFecha, actualizarHash, listarTodos, listarPagados, buscarPorHash, buscarPorId, marcarPagado, resumenDashboard, resumenPorProducto, ventasPorProductoDetalle };
