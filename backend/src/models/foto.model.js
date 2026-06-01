const db = require('../config/db');

// Galería pública: solo fotos publicadas, más nuevas primero.
async function listarPublicadas(limit = 300) {
  const [rows] = await db.query(
    'SELECT id, url, marco, creado_en FROM fotos WHERE publicada = 1 ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows;
}

// Panel de moderación: todas (publicadas y ocultas).
async function listarTodas(limit = 500) {
  const [rows] = await db.query(
    'SELECT id, url, marco, publicada, creado_en FROM fotos ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows;
}

async function buscarPorId(id) {
  const [rows] = await db.query(
    'SELECT id, archivo, url, marco, publicada, creado_en FROM fotos WHERE id = ?', [id]
  );
  return rows[0] || null;
}

async function crear({ archivo, url, marco = null, publicada = 1 }) {
  const [result] = await db.query(
    'INSERT INTO fotos (archivo, url, marco, publicada) VALUES (?, ?, ?, ?)',
    [archivo, url, marco, publicada ? 1 : 0]
  );
  return result.insertId;
}

async function setPublicada(id, publicada) {
  await db.query('UPDATE fotos SET publicada = ? WHERE id = ?', [publicada ? 1 : 0, id]);
}

async function eliminar(id) {
  await db.query('DELETE FROM fotos WHERE id = ?', [id]);
}

module.exports = { listarPublicadas, listarTodas, buscarPorId, crear, setPublicada, eliminar };
