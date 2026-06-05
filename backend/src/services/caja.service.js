const pedidoService = require('./pedido.service');
const expendioService = require('./expendio.service');
const pedidoModel = require('../models/pedido.model');
const cajaLecturaModel = require('../models/cajaLectura.model');
const { notificarLecturaCaja } = require('../utils/rtsClient');

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
  const pedido = await pedidoService.crearPedido(datos, {
    lista: 'normal',
    origen: 'caja',
    cobro: { metodo, recibido, operador },
  });

  // Dispara la comanda a RETIRO con todos los ítems. Si falla (RTS/red), NO
  // rompemos el cobro: el pedido ya quedó PAGADO y se puede re-disparar desde el
  // modo "Preventa / Retiro" buscándolo por su código.
  let comanda = false;
  let numero = null; // #XX de retiro: el comandaId que se canta en el mostrador.
  try {
    const r = await expendioService.registrarEntrega(
      pedido.hash,
      items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad })),
      operador
    );
    comanda = true;
    // El comandaId es el número consecutivo y único de la comanda en RETIRO.
    // Lo devolvemos para imprimirlo en el ticket del comensal (clave para quien
    // no tiene celular: se lleva su #XX impreso y sabe cuándo lo llaman).
    numero = r?.comandaId ?? null;
  } catch (err) {
    console.error('[caja] cobro OK pero no se disparó la comanda a retiro:', err.message);
  }

  return { ...pedido, comanda, numero };
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

module.exports = { tomarPedido, tomarPedidoQr, registrarLectura, listarLecturas, atenderLectura };
