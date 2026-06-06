const db = require('../config/db');

async function crear(datos, conn) {
  const { cedula, familia, contacto, total, metodo_pago, origen } = datos;
  const [result] = await (conn || db).query(
    `INSERT INTO pedidos (cedula, familia, contacto, total, metodo_pago, origen, hash, estado)
     VALUES (?, ?, ?, ?, ?, ?, '', 'PENDIENTE')`,
    [cedula, familia, contacto, total, metodo_pago || null, origen || null]
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
    `SELECT idpedido, hash, fecha, cedula, familia, contacto, total,
            metodo_pago, cobro_metodo, bancard_status, origen, estado
     FROM pedidos ORDER BY idpedido DESC`
  );
  return rows;
}

async function listarPagados() {
  const [rows] = await db.query(
    // Los JUEGO no cuentan para el saldo de retiro: se dispensan como créditos en
    // la tarjeta, no se retiran en el mostrador. Excluyéndolos del conteo, un pedido
    // solo de comida se marca "completo" al retirarla, y uno solo de juegos da 0/0
    // (no aparece como pendiente de retiro en la caja).
    `SELECT p.idpedido, p.hash, p.fecha, p.cedula, p.familia, p.total,
            COALESCE(SUM(CASE WHEN pr.categoria <> 'JUEGO' THEN pp.cantidad ELSE 0 END), 0) AS total_items,
            COALESCE(SUM(CASE WHEN pr.categoria <> 'JUEGO' THEN ent.entregado ELSE 0 END), 0) AS total_entregado,
            (SELECT ev.estacion FROM expendio_envios ev
              WHERE ev.idpedido = p.idpedido AND ev.estado = 'PENDIENTE'
              ORDER BY ev.creado_en DESC LIMIT 1) AS estacion_activa
     FROM pedidos p
     LEFT JOIN pedidos_productos pp ON pp.idpedido = p.idpedido
     LEFT JOIN productos pr ON pr.idproducto = pp.idproducto
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

// Pedidos PAGADOS de un mismo celular, para la "bolsa" de autoretiro agrupado.
// Comparamos por los últimos 9 dígitos (el móvil PY sin país 595 ni 0 inicial):
// limpiamos los separadores típicos del contacto guardado y tomamos RIGHT(...,9),
// que coincide con normalizarTel() del backend. Orden FIFO (más viejo primero)
// para repartir el retiro parcial de forma estable entre pedidos.
async function pagadosPorContacto(tel9) {
  const [rows] = await db.query(
    `SELECT idpedido, hash, familia, fecha, contacto, total
     FROM pedidos
     WHERE estado = 'PAGADO'
       AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(contacto,'-',''),' ',''),'+',''),'(',''),')',''), 9) = ?
     ORDER BY fecha ASC, idpedido ASC`,
    [tel9]
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

// Pedidos PENDIENTES para cobrar en caja (los más viejos primero: orden de llegada).
async function listarPendientes() {
  const [rows] = await db.query(
    `SELECT idpedido, hash, fecha, cedula, familia, contacto, total, metodo_pago
     FROM pedidos
     WHERE estado = 'PENDIENTE'
     ORDER BY fecha ASC`
  );
  return rows;
}

// Cobro en caja: marca PAGADO y registra cómo/quién/cuándo se cobró.
// `recibido` es el efectivo entregado por el cliente (para el vuelto); puede ser null.
async function registrarCobro(id, { metodo, recibido, operador }, conn) {
  await (conn || db).query(
    `UPDATE pedidos
     SET estado = 'PAGADO',
         cobro_metodo = ?, cobro_recibido = ?, cobro_fecha = NOW(), cobro_operador = ?
     WHERE idpedido = ?`,
    [metodo, recibido ?? null, operador || null, id]
  );
}

// Edita los datos de contacto del pedido (no toca total ni ítems).
async function actualizarDatos(id, { cedula, familia, contacto }) {
  await db.query(
    'UPDATE pedidos SET cedula = ?, familia = ?, contacto = ? WHERE idpedido = ?',
    [cedula || null, familia, contacto, id]
  );
}

async function cambiarEstado(id, estado) {
  await db.query('UPDATE pedidos SET estado = ? WHERE idpedido = ?', [estado, id]);
}

// ----- Bancard / QR -----

async function buscarPorHookAlias(hookAlias) {
  const [rows] = await db.query(
    'SELECT * FROM pedidos WHERE bancard_hook_alias = ?', [hookAlias]
  );
  return rows[0] || null;
}

// Guarda los datos del QR recién generado en el pedido.
async function guardarQrBancard(id, { hookAlias, qrData, qrUrl }) {
  await db.query(
    `UPDATE pedidos
     SET bancard_hook_alias = ?, bancard_qr_data = ?, bancard_qr_url = ?, bancard_status = 'GENERATED'
     WHERE idpedido = ?`,
    [hookAlias, qrData, qrUrl || null, id]
  );
}

// Confirma el pago desde el callback: marca PAGADO y guarda datos de Bancard.
async function marcarPagadoBancard(id, { ticket, authorization } = {}) {
  await db.query(
    `UPDATE pedidos
     SET estado = 'PAGADO', bancard_status = 'confirmed',
         bancard_ticket = ?, bancard_authorization = ?
     WHERE idpedido = ?`,
    [ticket || null, authorization || null, id]
  );
}

// Marca el resultado crudo de Bancard sin tocar el estado del pedido
// (pago fallido, reversa, etc.).
async function actualizarStatusBancard(id, status) {
  await db.query(
    'UPDATE pedidos SET bancard_status = ? WHERE idpedido = ?', [status, id]
  );
}

async function resumenDashboard() {
  const [rows] = await db.query(`
    SELECT
      SUM(CASE WHEN estado <> 'ANULADO' THEN 1 ELSE 0 END) AS total_pedidos,
      SUM(CASE WHEN estado = 'PAGADO' THEN 1 ELSE 0 END) AS pagados,
      SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN estado = 'ANULADO' THEN 1 ELSE 0 END) AS anulados,
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

  // Totales de pedidos: contar y sumar SOLO sobre pedidos (sin join a
  // pedidos_productos, que multiplicaría ped.total por cada línea de producto).
  const [[totPedidos]] = await db.query(`
    SELECT
      COUNT(*)                    AS pedidos,
      COALESCE(SUM(ped.total), 0) AS monto
    FROM pedidos ped
    WHERE ${whereSql}
  `, params);

  // Agregados a nivel de producto (sí requieren el join).
  const [[totProductos]] = await db.query(`
    SELECT
      COALESCE(SUM(pp.cantidad), 0) AS unidades,
      COUNT(DISTINCT pp.idproducto) AS productos_distintos
    FROM pedidos_productos pp
    JOIN pedidos ped ON ped.idpedido = pp.idpedido
    WHERE ${whereSql}
  `, params);

  const totales = { ...totPedidos, ...totProductos };

  return { productos, totales };
}

module.exports = { crear, obtenerFecha, actualizarHash, listarTodos, listarPagados, listarPendientes, pagadosPorContacto, buscarPorHash, buscarPorId, marcarPagado, registrarCobro, actualizarDatos, cambiarEstado, buscarPorHookAlias, guardarQrBancard, marcarPagadoBancard, actualizarStatusBancard, resumenDashboard, resumenPorProducto, ventasPorProductoDetalle };
