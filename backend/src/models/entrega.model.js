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

module.exports = { registrar, obtenerEntregasPorPedido, obtenerBoleta, historialBoletas };
