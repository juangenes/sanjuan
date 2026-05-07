const db = require('../config/db');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

async function listar() {
  const [rows] = await db.query(
    `SELECT id, usuario, rol, nombre, activo, creado_en, ultimo_login
       FROM usuarios ORDER BY rol, usuario`
  );
  return rows;
}

async function buscarPorId(id) {
  const [rows] = await db.query(
    `SELECT id, usuario, rol, nombre, activo, creado_en, ultimo_login
       FROM usuarios WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function buscarPorUsuario(usuario) {
  const [rows] = await db.query(
    `SELECT id, usuario, password_hash, rol, nombre, activo
       FROM usuarios WHERE usuario = ?`,
    [usuario]
  );
  return rows[0] || null;
}

async function contar() {
  const [rows] = await db.query('SELECT COUNT(*) AS n FROM usuarios');
  return rows[0].n;
}

async function crear({ usuario, password, rol, nombre = null, activo = 1 }) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [result] = await db.query(
    `INSERT INTO usuarios (usuario, password_hash, rol, nombre, activo)
     VALUES (?, ?, ?, ?, ?)`,
    [usuario, hash, rol, nombre, activo ? 1 : 0]
  );
  return result.insertId;
}

async function actualizar(id, { usuario, rol, nombre, activo }) {
  await db.query(
    `UPDATE usuarios SET usuario = ?, rol = ?, nombre = ?, activo = ? WHERE id = ?`,
    [usuario, rol, nombre, activo ? 1 : 0, id]
  );
}

async function cambiarPassword(id, password) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, id]);
}

async function eliminar(id) {
  await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
}

async function registrarLogin(id) {
  await db.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?', [id]);
}

function verificarPassword(plano, hash) {
  return bcrypt.compare(plano, hash);
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorUsuario,
  contar,
  crear,
  actualizar,
  cambiarPassword,
  eliminar,
  registrarLogin,
  verificarPassword,
};
