const db = require('../config/db');

// Una "comanda" es un envío a RETIRO ligado a una entrega concreta (idot).
// estado PENDIENTE = todavía no se imprimió/colgó en retiro; ATENDIDO = ya impresa.

// Crea una comanda para retiro (la encola para que la pantalla la imprima).
async function crear(idpedido, estacion, operador, idot) {
  const [result] = await db.query(
    `INSERT INTO expendio_envios (idpedido, idot, estacion, enviado_por) VALUES (?, ?, ?, ?)`,
    [idpedido, idot || null, estacion, operador || null]
  );
  return result.insertId;
}

// Comandas pendientes de imprimir en una estación (la pantalla de retiro las
// toma, imprime y marca atendidas). Trae datos del pedido para la comanda.
async function listarComandasPendientes(estacion) {
  const [rows] = await db.query(
    `SELECT e.id, e.idot, e.idpedido, e.creado_en, e.enviado_por,
            p.hash, p.familia, p.cedula
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

module.exports = { crear, listarComandasPendientes, marcarAtendido };
