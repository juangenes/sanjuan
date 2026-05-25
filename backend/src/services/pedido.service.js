const db = require('../config/db');
const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const productoModel = require('../models/producto.model');
const { generarHash } = require('../utils/hash');

async function crearPedido({ cedula, familia, contacto, items, metodo_pago }) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Validar stock y calcular total
    let total = 0;
    const itemsValidados = [];

    for (const item of items) {
      const producto = await productoModel.buscarPorId(item.idproducto);
      if (!producto) throw new Error(`Producto ${item.idproducto} no encontrado`);
      if (!producto.activo) throw new Error(`${producto.titulo} no está disponible`);
      if (producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para ${producto.titulo}. Disponible: ${producto.stock}`);
      }
      const precio = producto.precio_preventa || producto.precio_normal;
      const subtotal = precio * item.cantidad;
      total += subtotal;
      itemsValidados.push({
        idproducto: producto.idproducto,
        cantidad: item.cantidad,
        precio_unitario: precio,
        subtotal,
      });
    }

    // Crear pedido
    const idpedido = await pedidoModel.crear({ cedula, familia, contacto, total, metodo_pago }, conn);
    const fecha = await pedidoModel.obtenerFecha(idpedido, conn);
    const hash = generarHash(idpedido, fecha);
    await pedidoModel.actualizarHash(idpedido, hash, conn);

    // Guardar items y descontar stock
    await pedidoProductoModel.insertarItems(idpedido, itemsValidados, conn);
    for (const item of itemsValidados) {
      await productoModel.actualizarStock(item.idproducto, item.cantidad, conn);
    }

    await conn.commit();
    return { idpedido, hash, total };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function obtenerPedidoPublico(hash) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return null;
  const items = await pedidoProductoModel.obtenerPorPedido(pedido.idpedido);
  return { ...pedido, items };
}

module.exports = { crearPedido, obtenerPedidoPublico };
