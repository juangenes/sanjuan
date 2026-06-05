const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const entregaModel = require('../models/entrega.model');
const envioModel = require('../models/envioExpendio.model');
const { notificarDespacho, notificarRetiro } = require('../utils/rtsClient');

// Modelo unificado "fast food": no hay estaciones. Toda comanda va a una única
// pantalla/impresora de RETIRO (scope sanjuan-retiro). "Disparar a retiro" es lo
// mismo que registrar la entrega: al registrarla se crea la comanda y se avisa a
// la pantalla para que la imprima y la cuelgue.
const RETIRO = 'RETIRO';

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

// Registra una entrega Y dispara su comanda a la pantalla de RETIRO. Es el único
// camino para "mandar a la cocina": lo usan la caja (walk-in y preventa) y el
// callback de Bancard (tótem). Marca lo entregado en el acto (sin checks en retiro).
async function registrarEntrega(hash, items, operador) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) throw new Error('Pedido no encontrado');
  if (pedido.estado !== 'PAGADO') throw new Error('El pedido no está pagado');

  // Re-chequea el saldo y registra la entrega de forma atómica (transacción con
  // lock sobre el pedido): si dos terminales disparan el mismo pedido a la vez, la
  // segunda relee el saldo recién cuando la primera confirmó y rechaza si ya no
  // queda. Evita el sobre-retiro por carrera. También garantiza idempotencia.
  const idot = await entregaModel.registrarConSaldo(pedido.idpedido, items, operador);

  // Encola la comanda y avisa a la pantalla de retiro (en vivo). Si el RTS falla,
  // la comanda igual queda PENDIENTE en la base y la pantalla la levanta al refrescar.
  const comandaId = await envioModel.crear(pedido.idpedido, RETIRO, operador, idot);
  notificarRetiro({ comandaId, idot, hash: pedido.hash, familia: pedido.familia });
  notificarDespacho({ motivo: 'entrega', hash });

  return { idot, comandaId };
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

// Cola de comandas pendientes de imprimir en RETIRO, cada una con sus ítems.
// La pantalla de retiro la consume, imprime y luego marca cada comanda impresa.
async function obtenerColaRetiro() {
  const comandas = await envioModel.listarComandasPendientes(RETIRO);
  const out = [];
  for (const c of comandas) {
    const items = c.idot
      ? await entregaModel.obtenerBoleta(c.idpedido, c.idot)
      : [];
    out.push({
      id: c.id,
      // Número de comanda consecutivo y ÚNICO por retiro (autoincremental de
      // expendio_envios). Es el #XXX que se canta para llamar a la gente: a
      // diferencia de `codigo` (derivado del hash del pedido), no se repite aunque
      // un mismo pedido genere varias comandas en retiros parciales.
      numero: c.id,
      idot: c.idot,
      hash: c.hash,
      // Código de PEDIDO (primeros 8 del hash), unificado con /admin, /pedido/:hash,
      // comprobantes, etc. Sirve para cruzar la comanda con la compra del cliente.
      codigo: (c.hash || '').substring(0, 8).toUpperCase(),
      familia: c.familia,
      creado_en: c.creado_en,
      items,
    });
  }
  return out;
}

// La pantalla de retiro confirma que imprimió/colgó la comanda → sale de la cola.
async function marcarComandaImpresa(id) {
  await envioModel.marcarAtendido(id);
}

module.exports = {
  obtenerPedidoParaExpendio, registrarEntrega, obtenerBoleta, obtenerHistorial,
  obtenerColaRetiro, marcarComandaImpresa,
};
