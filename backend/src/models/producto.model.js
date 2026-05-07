const db = require('../config/db');

async function listarActivos() {
  const [rows] = await db.query(
    'SELECT * FROM productos WHERE activo = 1 ORDER BY categoria, idproducto'
  );
  return rows;
}

async function listarTodos() {
  const [rows] = await db.query('SELECT * FROM productos ORDER BY categoria, idproducto');
  return rows;
}

async function buscarPorId(id) {
  const [rows] = await db.query('SELECT * FROM productos WHERE idproducto = ?', [id]);
  return rows[0] || null;
}

async function actualizarStock(idproducto, cantidad, conn) {
  const db_ = conn || db;
  await db_.query(
    'UPDATE productos SET stock = stock - ? WHERE idproducto = ?',
    [cantidad, idproducto]
  );
}

async function reponerStock(idproducto, cantidad, conn) {
  const db_ = conn || db;
  await db_.query(
    'UPDATE productos SET stock = stock + ? WHERE idproducto = ?',
    [cantidad, idproducto]
  );
}

async function actualizarProducto(id, datos) {
  const { titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock } = datos;
  await db.query(
    `UPDATE productos SET titulo=?, descripcion=?, imagen=?, precio_preventa=?,
     precio_normal=?, activo=?, categoria=?, stock=? WHERE idproducto=?`,
    [titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock, id]
  );
}

async function crearProducto(datos) {
  const { titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock } = datos;
  const [result] = await db.query(
    `INSERT INTO productos (titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [titulo, descripcion, imagen, precio_preventa, precio_normal, activo ?? 1, categoria, stock ?? 0]
  );
  return result.insertId;
}

async function eliminarProducto(id) {
  await db.query('DELETE FROM productos WHERE idproducto = ?', [id]);
}

module.exports = { listarActivos, listarTodos, buscarPorId, actualizarStock, reponerStock, actualizarProducto, crearProducto, eliminarProducto };
