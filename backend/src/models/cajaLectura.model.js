const db = require('../config/db');

// Una "lectura" es un QR de cliente que el lector del celular mandó a una caja.
// estado PENDIENTE = todavía no la atendió la caja; ATENDIDA = se entregó/usó;
// DESCARTADA = la caja la descartó a mano.

// Crea una lectura para una caja (la encola para que la pantalla de caja la levante).
async function crear({ caja, codigo, hash, idpedido, familia, operador }) {
  const [result] = await db.query(
    `INSERT INTO caja_lectura (caja, codigo, hash, idpedido, familia, enviado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [String(caja), codigo, hash || null, idpedido || null, familia || null, operador || null]
  );
  return result.insertId;
}

// Lecturas pendientes de una caja, más recientes primero. Auto-expira las viejas
// (>30 min) para que una lectura olvidada no quede colgada en la lista.
async function listarPendientes(caja) {
  const [rows] = await db.query(
    `SELECT id, caja, codigo, hash, idpedido, familia, creado_en, enviado_por
     FROM caja_lectura
     WHERE caja = ? AND estado = 'PENDIENTE'
       AND creado_en > (NOW() - INTERVAL 30 MINUTE)
     ORDER BY creado_en DESC`,
    [String(caja)]
  );
  return rows;
}

async function marcarAtendida(id, estado = 'ATENDIDA') {
  await db.query(
    `UPDATE caja_lectura SET estado = ?, atendido_en = NOW() WHERE id = ?`,
    [estado === 'DESCARTADA' ? 'DESCARTADA' : 'ATENDIDA', id]
  );
}

module.exports = { crear, listarPendientes, marcarAtendida };
