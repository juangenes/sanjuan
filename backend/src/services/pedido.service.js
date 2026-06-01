const db = require('../config/db');
const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const productoModel = require('../models/producto.model');
const { generarHash } = require('../utils/hash');
const { notificarDespacho } = require('../utils/rtsClient');

const METODOS_COBRO = ['EFECTIVO', 'POS_DEBITO', 'POS_CREDITO'];

// Crea un pedido. `opts`:
//   lista: 'preventa' (default, precio con descuento) | 'normal' (precio del día)
//   cobro: { metodo, recibido, operador } → cobra en el acto y deja el pedido PAGADO
//          (caja del día). Si es null, queda PENDIENTE (preventa / tienda online).
//   origen: 'tienda' | 'caja' | 'totem' → canal de origen, para etiquetar la comanda
//           cuando el pago QR lo confirma el callback de Bancard.
async function crearPedido({ cedula, familia, contacto, items, metodo_pago }, opts = {}) {
  const lista = opts.lista === 'normal' ? 'normal' : 'preventa';
  const cobro = opts.cobro || null;
  const origen = opts.origen || null;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Validar stock y calcular total según la lista de precios elegida
    let total = 0;
    const itemsValidados = [];

    for (const item of items) {
      const producto = await productoModel.buscarPorId(item.idproducto);
      if (!producto) throw new Error(`Producto ${item.idproducto} no encontrado`);
      if (!producto.activo) throw new Error(`${producto.titulo} no está disponible`);
      if (producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para ${producto.titulo}. Disponible: ${producto.stock}`);
      }
      const precio = lista === 'normal'
        ? (Number(producto.precio_normal) || Number(producto.precio_preventa))
        : (Number(producto.precio_preventa) || Number(producto.precio_normal));
      const subtotal = precio * item.cantidad;
      total += subtotal;
      itemsValidados.push({
        idproducto: producto.idproducto,
        cantidad: item.cantidad,
        precio_unitario: precio,
        subtotal,
      });
    }

    // Cobro inmediato (caja): validar contra el total recién calculado
    let vuelto = 0;
    let recibidoNum = null;
    if (cobro) {
      if (!METODOS_COBRO.includes(cobro.metodo)) throw new Error('Método de cobro inválido');
      if (cobro.metodo === 'EFECTIVO') {
        recibidoNum = Number(cobro.recibido);
        if (!Number.isFinite(recibidoNum) || recibidoNum < total) {
          throw new Error('El monto recibido no cubre el total del pedido');
        }
        vuelto = recibidoNum - total;
      }
    }

    // Crear pedido
    const idpedido = await pedidoModel.crear({ cedula, familia, contacto, total, metodo_pago, origen }, conn);
    const fecha = await pedidoModel.obtenerFecha(idpedido, conn);
    const hash = generarHash(idpedido, fecha);
    await pedidoModel.actualizarHash(idpedido, hash, conn);

    // Guardar items y descontar stock
    await pedidoProductoModel.insertarItems(idpedido, itemsValidados, conn);
    for (const item of itemsValidados) {
      await productoModel.actualizarStock(item.idproducto, item.cantidad, conn);
    }

    // Si fue cobrado en caja, dejarlo PAGADO con los datos del cobro
    if (cobro) {
      await pedidoModel.registrarCobro(
        idpedido,
        { metodo: cobro.metodo, recibido: recibidoNum, operador: cobro.operador },
        conn
      );
    }

    await conn.commit();
    // Si la caja lo cobró (queda PAGADO), avisar al panel de despacho en vivo.
    if (cobro) notificarDespacho({ motivo: 'caja', hash });
    return { idpedido, hash, total, vuelto };
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

module.exports = { crearPedido, obtenerPedidoPublico, METODOS_COBRO };
