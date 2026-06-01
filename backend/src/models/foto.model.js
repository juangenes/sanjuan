const db = require('../config/db');

// Galería pública: solo publicadas, más nuevas primero (DESC). Paginación por
// cursor para el scroll infinito: `before` trae las anteriores a ese id.
async function listarPublicadas({ before = null, limit = 24 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 24, 1), 300);
  if (before) {
    const [rows] = await db.query(
      'SELECT id, url, marco, creado_en FROM fotos WHERE publicada = 1 AND id < ? ORDER BY id DESC LIMIT ?',
      [Number(before), lim]
    );
    return rows;
  }
  const [rows] = await db.query(
    'SELECT id, url, marco, creado_en FROM fotos WHERE publicada = 1 ORDER BY id DESC LIMIT ?',
    [lim]
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
