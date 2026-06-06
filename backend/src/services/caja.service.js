const pedidoService = require('./pedido.service');
const expendioService = require('./expendio.service');
const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const cajaLecturaModel = require('../models/cajaLectura.model');
const { notificarLecturaCaja } = require('../utils/rtsClient');
const { CATEGORIAS_SIN_RETIRO } = require('../config/categorias');

// Caja del día: el cajero arma un pedido nuevo (productos elegidos en el momento),
// cobra en persona y lo deja PAGADO. Usa la lista de precios NORMAL (no preventa).
// Acto único pago+expendio: al cobrar, dispara la comanda a RETIRO (la cocina la
// imprime y la cuelga) y el comensal se lleva su ticket para retirar.
async function tomarPedido({ nombre, cedula, contacto, items, metodo, recibido }, operador) {
  if (!items?.length) throw new Error('El pedido no tiene ítems');

  const datos = {
    cedula: cedula?.trim() || null,
    familia: (nombre && nombre.trim()) || 'Mostrador',
    contacto: contacto?.trim() || '',
    metodo_pago: metodo,
    items,
  };

  // crearPedido valida stock, calcula el total con precio normal, cobra y deja
  // el pedido PAGADO de forma transaccional. Devuelve { idpedido, hash, total, vuelto }.
  // NO disparamos la comanda acá: tras confirmar el cobro, la pantalla de caja le
  // pregunta al cliente "¿retirás todo ahora o por partes?". Si elige "todo ahora"
  // llama a despacharTodo; si elige "por partes", sigue desde su celular (no se
  // dispara nada y retira cuando quiera, como una preventa).
  const pedido = await pedidoService.crearPedido(datos, {
    lista: 'normal',
    origen: 'caja',
    cobro: { metodo, recibido, operador },
  });

  return { ...pedido };
}

// "Retirar todo ahora": dispara la comanda con TODO lo pendiente del pedido y
// devuelve su #XX (comandaId) para que la caja lo muestre/imprima. Lo usa la
// pantalla de caja cuando el cliente elige retirar todo apenas paga. registrarEntrega
// re-chequea el saldo con lock, así que es idempotente y no entrega de más.
async function despacharTodo(hash, operador) {
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) throw new Error('Pedido no encontrado');

  const productos = await pedidoProductoModel.obtenerPorPedido(pedido.idpedido);
  // Excluimos las categorías SIN_RETIRO (juegos, figuritas): no se retiran en el
  // mostrador. Si el pedido es SOLO de ésas, no hay comanda que disparar.
  const items = productos
    .filter(p => !CATEGORIAS_SIN_RETIRO.includes(p.categoria))
    .map(p => ({ idproducto: p.idproducto, cantidad: p.cantidad }));
  if (!items.length) return { numero: null, idot: null };

  const { idot, comandaId } = await expendioService.registrarEntrega(hash, items, operador);
  return { numero: comandaId, idot };
}

// Caja con pago por QR de Bancard: NO cobra en el acto. Crea el pedido PENDIENTE
// (precio normal, método INFONET, origen 'caja') y devuelve su hash para que el
// front genere el QR y poletee el estado. El pago lo confirma el callback de
// Bancard, que recién ahí marca PAGADO y dispara la comanda a RETIRO (etiquetada
// 'caja' gracias a origen). No firamos la comanda acá: el pedido sigue pendiente.
async function tomarPedidoQr({ nombre, cedula, contacto, items }) {
  if (!items?.length) throw new Error('El pedido no tiene ítems');

  const datos = {
    cedula: cedula?.trim() || null,
    familia: (nombre && nombre.trim()) || 'Mostrador',
    contacto: contacto?.trim() || '',
    metodo_pago: 'INFONET',
    items,
  };

  // Sin `cobro`: queda PENDIENTE. `lista: 'normal'` = precio del día.
  return pedidoService.crearPedido(datos, { lista: 'normal', origen: 'caja' });
}

// ── Lecturas del lector (celular) → caja ────────────────────────────────────
// El lector del celular escanea el QR del cliente (que suele ser la URL de su
// pedido, https://.../pedido/<hash>) y lo manda a una caja. Acá normalizamos el
// código a un hash, intentamos resolver el pedido (para mostrar la familia en la
// lista de la caja), lo guardamos en la cola y avisamos por RTS a esa caja.

// Saca el hash de lo escaneado: si es una URL .../pedido/<hash>, toma ese tramo;
// si no, usa el texto tal cual. El QrScanner manda en mayúsculas, así que lo
// normalizamos a minúsculas (MySQL _ci igual matchea, pero lo dejamos prolijo).
function parseHash(codigo) {
  const raw = String(codigo || '').trim();
  const m = raw.match(/\/pedido\/([^/?#\s]+)/i);
  const hash = (m ? m[1] : raw).trim();
  return hash.toLowerCase();
}

async function registrarLectura({ caja, codigo }, operador) {
  if (!caja) throw new Error('Falta la caja destino');
  if (!codigo || !String(codigo).trim()) throw new Error('Lectura vacía');

  const hash = parseHash(codigo);
  // Puede no encontrarse (código equivocado) o no estar pagado: igual la guardamos
  // y la caja decide. Si lo encontramos, mostramos la familia en la lista.
  const pedido = hash ? await pedidoModel.buscarPorHash(hash) : null;

  const id = await cajaLecturaModel.crear({
    caja,
    codigo: String(codigo).trim(),
    hash: pedido ? pedido.hash : hash,
    idpedido: pedido ? pedido.idpedido : null,
    familia: pedido ? pedido.familia : null,
    operador,
  });

  notificarLecturaCaja(caja, {
    id,
    codigo: String(codigo).trim(),
    hash: pedido ? pedido.hash : hash,
    familia: pedido ? pedido.familia : null,
  });

  return {
    id,
    caja: String(caja),
    hash: pedido ? pedido.hash : hash,
    familia: pedido ? pedido.familia : null,
    encontrado: !!pedido,
  };
}

function listarLecturas(caja) {
  if (!caja) throw new Error('Falta la caja');
  return cajaLecturaModel.listarPendientes(caja);
}

function atenderLectura(id, estado) {
  return cajaLecturaModel.marcarAtendida(id, estado);
}

module.exports = { tomarPedido, tomarPedidoQr, despacharTodo, registrarLectura, listarLecturas, atenderLectura };
