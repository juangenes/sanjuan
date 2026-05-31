const db = require('../config/db');

// Rutea un pedido a una estación (lo agrega a su cola de despacho).
async function crear(idpedido, estacion, operador) {
  const [result] = await db.query(
    `INSERT INTO expendio_envios (idpedido, estacion, enviado_por) VALUES (?, ?, ?)`,
    [idpedido, estacion, operador || null]
  );
  return result.insertId;
}

// Cola pendiente de una estación, con datos del pedido para mostrar.
async function listarCola(estacion) {
  const [rows] = await db.query(
    `SELECT e.id, e.idpedido, e.estacion, e.creado_en, e.enviado_por,
            p.hash, p.familia, p.cedula,
            (SELECT COALESCE(SUM(pp.cantidad), 0)
               FROM pedidos_productos pp WHERE pp.idpedido = p.idpedido) AS total_items
     FROM expendio_envios e
     JOIN pedidos p ON p.idpedido = e.idpedido
     WHERE e.estacion = ? AND e.estado = 'PENDIENTE'
     ORDER BY e.creado_en ASC`,
    [estacion]
  );
  return rows;
}

async function marcarAtendido(id) {
  await db.query(
    `UPDATE expendio_envios SET estado = 'ATENDIDO', atendido_en = NOW() WHERE id = ?`,
    [id]
  );
}

module.exports = { crear, listarCola, marcarAtendido };
