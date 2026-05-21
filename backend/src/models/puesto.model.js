const db = require('../config/db');

async function listarActivos() {
  const [rows] = await db.query(
    'SELECT id, codigo, nombre, responsable, activo FROM puestos WHERE activo = 1 ORDER BY id'
  );
  return rows;
}

async function listarTodos() {
  const [rows] = await db.query(
    'SELECT id, codigo, nombre, responsable, activo FROM puestos ORDER BY id'
  );
  return rows;
}

async function buscarPorId(id) {
  const [rows] = await db.query(
    'SELECT id, codigo, nombre, responsable, activo FROM puestos WHERE id = ?', [id]
  );
  return rows[0] || null;
}

async function crear({ codigo = null, nombre, responsable = null, activo = 1 }) {
  const [result] = await db.query(
    'INSERT INTO puestos (codigo, nombre, responsable, activo) VALUES (?, ?, ?, ?)',
    [codigo || null, nombre, responsable, activo ? 1 : 0]
  );
  return result.insertId;
}

async function actualizar(id, { codigo = null, nombre, responsable = null, activo = 1 }) {
  await db.query(
    'UPDATE puestos SET codigo = ?, nombre = ?, responsable = ?, activo = ? WHERE id = ?',
    [codigo || null, nombre, responsable, activo ? 1 : 0, id]
  );
}

async function eliminar(id) {
  await db.query('DELETE FROM puestos WHERE id = ?', [id]);
}

module.exports = { listarActivos, listarTodos, buscarPorId, crear, actualizar, eliminar };
