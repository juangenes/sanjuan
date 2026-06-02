const db = require('../config/db');

async function listar() {
  const [rows] = await db.query('SELECT clave, valor FROM configuracion');
  return rows;
}

// Upsert: crea la clave si no existe, o actualiza el valor si ya está.
async function guardar(clave, valor) {
  await db.query(
    'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ' +
    'ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
    [clave, valor]
  );
}

module.exports = { listar, guardar };
