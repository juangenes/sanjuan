const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const entregaModel = require('../models/entrega.model');

async function obtenerPedidoParaExpendio(hash) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return null;
  if (pedido.estado !== 'PAGADO') throw new Error('El pedido no está pagado');

  const items = await pedidoProductoModel.obtenerPorPedido(pedido.idpedido);
  const entregas = await entregaModel.obtenerEntregasPorPedido(pedido.idpedido);

  const entregasMap = {};
  for (const e of entregas) entregasMap[e.idproducto] = Number(e.entregado);

  const detalle = items.map(item => ({
    ...item,
    entregado: entregasMap[item.idproducto] || 0,
    pendiente: item.cantidad - (entregasMap[item.idproducto] || 0),
  }));

  return { ...pedido, items: detalle };
}

async function registrarEntrega(hash, items, operador) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) throw new Error('Pedido no encontrado');
  if (pedido.estado !== 'PAGADO') throw new Error('El pedido no está pagado');

  // Validar que no se entregue más de lo pedido
  const pedidoItems = await pedidoProductoModel.obtenerPorPedido(pedido.idpedido);
  const entregas = await entregaModel.obtenerEntregasPorPedido(pedido.idpedido);
  const entregasMap = {};
  for (const e of entregas) entregasMap[e.idproducto] = Number(e.entregado);

  for (const item of items) {
    const pedidoItem = pedidoItems.find(p => p.idproducto === item.idproducto);
    if (!pedidoItem) throw new Error(`Producto ${item.idproducto} no pertenece al pedido`);
    const yaEntregado = entregasMap[item.idproducto] || 0;
    if (yaEntregado + item.cantidad > pedidoItem.cantidad) {
      throw new Error(`No podés entregar más de lo pedido para ${pedidoItem.titulo}`);
    }
  }

  const idot = await entregaModel.registrar(pedido.idpedido, items, operador);
  return idot;
}

async function obtenerBoleta(hash, idot) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return null;
  const items = await entregaModel.obtenerBoleta(pedido.idpedido, idot);
  return { pedido, items };
}

async function obtenerHistorial(hash) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return null;
  const historial = await entregaModel.historialBoletas(pedido.idpedido);
  return historial;
}

module.exports = { obtenerPedidoParaExpendio, registrarEntrega, obtenerBoleta, obtenerHistorial };
