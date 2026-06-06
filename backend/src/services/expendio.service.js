const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const entregaModel = require('../models/entrega.model');
const envioModel = require('../models/envioExpendio.model');
const configService = require('./configuracion.service');
const telToken = require('../utils/telToken');
const { notificarDespacho, notificarRetiro } = require('../utils/rtsClient');
const { CATEGORIAS_SIN_RETIRO } = require('../config/categorias');

// Modelo unificado "fast food": no hay estaciones. Toda comanda va a una única
// pantalla/impresora de RETIRO (scope sanjuan-retiro). "Disparar a retiro" es lo
// mismo que registrar la entrega: al registrarla se crea la comanda y se avisa a
// la pantalla para que la imprima y la cuelgue.
const RETIRO = 'RETIRO';

async function obtenerPedidoParaExpendio(hash) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return null;
  if (pedido.estado !== 'PAGADO') throw new Error('El pedido no está pagado');

  // Las categorías SIN_RETIRO (juegos, figuritas) no se retiran en el mostrador:
  // los juegos se dispensan como créditos en la tarjeta y las figuritas se entregan
  // en mano en la caja. No las mostramos como ítems retirables.
  const items = (await pedidoProductoModel.obtenerPorPedido(pedido.idpedido))
    .filter(i => !CATEGORIAS_SIN_RETIRO.includes(i.categoria));
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

  // Guard central de TODOS los disparos a RETIRO (caja, autoretiro del celular y
  // tótem): descartamos las categorías SIN_RETIRO (juegos, figuritas). Los juegos
  // se cargan como créditos en la tarjeta y las figuritas se entregan en mano en la
  // caja. Así nunca terminan en una comanda de cocina, venga del flujo que venga.
  const productos = await pedidoProductoModel.obtenerPorPedido(pedido.idpedido);
  const sinRetiro = new Set(
    productos.filter(p => CATEGORIAS_SIN_RETIRO.includes(p.categoria)).map(p => Number(p.idproducto))
  );
  const itemsRetiro = items.filter(i => !sinRetiro.has(Number(i.idproducto)));
  if (!itemsRetiro.length) {
    throw new Error('Este pedido no tiene ítems de retiro (los juegos y figuritas no se retiran acá)');
  }

  // Re-chequea el saldo y registra la entrega de forma atómica (transacción con
  // lock sobre el pedido): si dos terminales disparan el mismo pedido a la vez, la
  // segunda relee el saldo recién cuando la primera confirmó y rechaza si ya no
  // queda. Evita el sobre-retiro por carrera. También garantiza idempotencia.
  const idot = await entregaModel.registrarConSaldo(pedido.idpedido, itemsRetiro, operador);

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

// Detalle de un pedido con el saldo pendiente por ítem (lo pedido menos lo ya
// entregado). Reutilizado por la bolsa de autoretiro para armar y repartir.
async function detalleConPendiente(idpedido) {
  const items = await pedidoProductoModel.obtenerPorPedido(idpedido);
  const entregas = await entregaModel.obtenerEntregasPorPedido(idpedido);
  const entregadoMap = {};
  for (const e of entregas) entregadoMap[e.idproducto] = Number(e.entregado);
  return items.map(it => {
    const entregado = entregadoMap[it.idproducto] || 0;
    return { ...it, entregado, pendiente: it.cantidad - entregado };
  });
}

// "Bolsa" de autoretiro: todos los pedidos PAGADOS de un mismo celular, con el
// saldo pendiente SUMADO por producto. La identidad es el token firmado del número
// (telToken): si es inválido devolvemos null (link adulterado o de otro número).
async function obtenerBolsa(token) {
  const tel9 = telToken.verificarToken(token);
  if (!tel9) return null;

  const pedidos = await pedidoModel.pagadosPorContacto(tel9);
  const detallePedidos = [];
  const bolsaMap = {}; // idproducto -> { idproducto, titulo, pendiente }

  for (const ped of pedidos) {
    const items = await detalleConPendiente(ped.idpedido);
    for (const it of items) {
      if (it.pendiente <= 0) continue;
      if (!bolsaMap[it.idproducto]) {
        bolsaMap[it.idproducto] = { idproducto: it.idproducto, titulo: it.titulo, pendiente: 0 };
      }
      bolsaMap[it.idproducto].pendiente += it.pendiente;
    }
    detallePedidos.push({
      idpedido: ped.idpedido,
      hash: ped.hash,
      codigo: (ped.hash || '').substring(0, 8).toUpperCase(),
      familia: ped.familia,
      fecha: ped.fecha,
      items,
    });
  }

  return {
    tel: tel9,
    familia: pedidos[0]?.familia || null,
    dia_d: configService.diaD(),
    pedidos: detallePedidos,
    bolsa: Object.values(bolsaMap),
  };
}

// Genera el link firmado de la bolsa de un celular + un resumen (nombre, cantidad
// de pedidos PAGADOS y total) para armar el mensaje de WhatsApp. Lo usan el admin y
// la caja: así ninguna pantalla necesita la lista completa de pedidos. Devuelve
// null si el número no es válido; cantidad 0 si no tiene pedidos pagados.
async function generarLinkBolsa(tel) {
  const token = telToken.generarToken(tel);
  if (!token) return null;
  const tel9 = telToken.verificarToken(token);
  const pedidos = await pedidoModel.pagadosPorContacto(tel9);
  const total = pedidos.reduce((s, p) => s + Number(p.total || 0), 0);
  return { token, familia: pedidos[0]?.familia || null, cantidad: pedidos.length, total };
}

// Dispara a RETIRO los ítems elegidos de la bolsa de un celular. El cliente pide
// por producto (la bolsa los muestra sumados); acá repartimos cada producto entre
// sus pedidos pendientes en orden FIFO (el más viejo primero) y disparamos UNA
// comanda por pedido afectado, reusando el camino atómico con lock de
// registrarEntrega (re-chequea saldo y evita el sobre-retiro por carrera).
async function registrarEntregaBolsa(token, solicitados, operador) {
  const tel9 = telToken.verificarToken(token);
  if (!tel9) throw new Error('Link inválido');

  const pedidos = await pedidoModel.pagadosPorContacto(tel9); // FIFO
  if (!pedidos.length) throw new Error('No hay pedidos para retirar');

  // Saldo pendiente fresco por pedido y producto.
  const pendientePorPedido = [];
  for (const ped of pedidos) {
    const items = await detalleConPendiente(ped.idpedido);
    const pend = {};
    for (const it of items) if (it.pendiente > 0) pend[it.idproducto] = it.pendiente;
    pendientePorPedido.push({ idpedido: ped.idpedido, hash: ped.hash, pend });
  }

  // Reparto FIFO de cada producto solicitado entre los pedidos que lo tienen.
  const asignacion = {}; // idpedido -> { hash, items: [{idproducto, cantidad}] }
  for (const sol of solicitados) {
    let restante = sol.cantidad;
    if (!(restante > 0)) continue;
    for (const ped of pendientePorPedido) {
      if (restante <= 0) break;
      const disp = ped.pend[sol.idproducto] || 0;
      if (disp <= 0) continue;
      const toma = Math.min(disp, restante);
      ped.pend[sol.idproducto] -= toma;
      restante -= toma;
      if (!asignacion[ped.idpedido]) asignacion[ped.idpedido] = { hash: ped.hash, items: [] };
      asignacion[ped.idpedido].items.push({ idproducto: sol.idproducto, cantidad: toma });
    }
    if (restante > 0) throw new Error('Ya no queda saldo suficiente. Refrescá e intentá de nuevo.');
  }

  // Una comanda por pedido afectado. Lo normal es un solo pedido → un solo #XX.
  const numeros = [];
  for (const idpedido of Object.keys(asignacion)) {
    const { hash, items } = asignacion[idpedido];
    const { comandaId } = await registrarEntrega(hash, items, operador);
    numeros.push(comandaId);
  }
  return { numeros };
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
  obtenerBolsa, registrarEntregaBolsa, generarLinkBolsa,
  obtenerColaRetiro, marcarComandaImpresa,
};
