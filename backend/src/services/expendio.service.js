const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const entregaModel = require('../models/entrega.model');
const envioModel = require('../models/envioExpendio.model');
const { notificarEntidad } = require('../utils/rtsClient');

// Estaciones de despacho (fijas). Agregar/quitar editando esta lista.
const ESTACIONES = [
  { id: 'exp1', label: 'Expendio 1' },
  { id: 'exp2', label: 'Expendio 2' },
  { id: 'exp3', label: 'Expendio 3' },
];
const esEstacionValida = (id) => ESTACIONES.some(e => e.id === id);
const labelEstacion = (id) => ESTACIONES.find(e => e.id === id)?.label || id;
// Nombre de la room en el RTS para una estación.
const scopeDe = (estacion) => `sanjuan-${estacion}`;

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

// Rutea un pedido (escaneado) a una estación: valida que esté PAGADO, lo agrega
// a la cola (DB = fuente de verdad) y avisa al RTS para que la pantalla de esa
// estación lo muestre al instante. Si el RTS falla, el envío igual queda en cola.
async function enviarAEstacion(hash, estacion, operador) {
  if (!esEstacionValida(estacion)) throw new Error('Estación inválida');
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) throw new Error('Pedido no encontrado');
  if (pedido.estado !== 'PAGADO') throw new Error('El pedido no está pagado');

  // Concurrencia: un pedido no puede estar activo en dos estaciones a la vez.
  // Si ya tiene un envío PENDIENTE (no atendido), se rechaza hasta que se libere.
  const activo = await envioModel.envioActivoDePedido(pedido.idpedido);
  if (activo) {
    throw new Error(`El pedido ya está activo en ${labelEstacion(activo.estacion)}`);
  }

  const envioId = await envioModel.crear(pedido.idpedido, estacion, operador);

  await notificarEntidad({
    resource: 'expendio',
    action: 'enviado',
    id: pedido.idpedido,
    scope: scopeDe(estacion),
    actor: { usuario: operador },
    meta: { envioId, hash: pedido.hash, familia: pedido.familia, estacion },
  });

  return { envioId, hash: pedido.hash, familia: pedido.familia, estacion };
}

async function obtenerCola(estacion) {
  if (!esEstacionValida(estacion)) throw new Error('Estación inválida');
  return envioModel.listarCola(estacion);
}

async function atenderEnvio(id) {
  await envioModel.marcarAtendido(id);
}

module.exports = {
  obtenerPedidoParaExpendio, registrarEntrega, obtenerBoleta, obtenerHistorial,
  ESTACIONES, enviarAEstacion, obtenerCola, atenderEnvio,
};
