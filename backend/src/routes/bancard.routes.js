const router = require('express').Router();
const pedidoModel = require('../models/pedido.model');
const bancard = require('../services/bancard.service');
const configService = require('../services/configuracion.service');

// ───────────────────────────────────────────────────────────────────────────
// Pago con QR de Bancard/Infonet (método de pago 'INFONET').
//
// Flujo:
//   1) El cliente (front) pide POST /qr con el hash del pedido. Generamos el QR
//      en Bancard, lo guardamos y devolvemos qr_data (EMVCo) para dibujarlo.
//   2) El cliente paga con Pago Móvil escaneando el QR.
//   3) Bancard invoca POST /callback notificando el resultado. Debemos responder
//      en <5s, si no Bancard hace timeout y reversa la transacción.
//   4) La pantalla del cliente hace polling a GET /estado/:hash hasta ver PAGADO.
//   5) Si el cliente cancela o no llega el callback a tiempo: PUT /revertir.
// ───────────────────────────────────────────────────────────────────────────

// POST /api/bancard/qr  { hash }
// Genera (o reutiliza) el QR de un pedido pendiente. Idempotente: si el pedido
// ya tiene un QR vigente lo devuelve en vez de generar uno nuevo.
router.post('/qr', async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'Hash requerido' });

    const pedido = await pedidoModel.buscarPorHash(hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado === 'PAGADO') {
      return res.json({ success: true, ya_pagado: true });
    }

    // Reutilizar QR ya generado (evita QRs huérfanos en Bancard).
    if (pedido.bancard_hook_alias && pedido.bancard_qr_data) {
      return res.json({
        success: true,
        hook_alias: pedido.bancard_hook_alias,
        qr_data: pedido.bancard_qr_data,
        url: pedido.bancard_qr_url,
      });
    }

    const amount = Math.round(Number(pedido.total));

    // MOCKUP: no llamamos a Bancard. Generamos un QR ficticio (igual de visible
    // en pantalla) y programamos la confirmación automática del pago.
    if (mockHabilitado()) {
      const hookAlias = `MOCK-${pedido.idpedido}-${Date.now()}`;
      const qrData = `MOCK|${hash}|Gs${amount}`;
      await pedidoModel.guardarQrBancard(pedido.idpedido, { hookAlias, qrData, qrUrl: null });
      programarConfirmacionMock(pedido.idpedido);
      return res.json({ success: true, mock: true, hook_alias: hookAlias, qr_data: qrData, url: null });
    }

    const { qr_express, supported_clients } = await bancard.generarQr({
      amount,
      description: `Pedido ${hash.substring(0, 8).toUpperCase()} - San Juan`,
    });

    await pedidoModel.guardarQrBancard(pedido.idpedido, {
      hookAlias: qr_express.hook_alias,
      qrData: qr_express.qr_data,
      qrUrl: qr_express.url,
    });
    console.log(`[bancard][qr] generado hook_alias=${qr_express.hook_alias} pedido=${pedido.idpedido} monto=${amount}`);

    res.json({
      success: true,
      hook_alias: qr_express.hook_alias,
      qr_data: qr_express.qr_data,
      url: qr_express.url,
      supported_clients,
    });
  } catch (err) {
    console.error('[bancard] Error generando QR:', err.message, err.bancard || '');
    res.status(502).json({ success: false, error: 'No se pudo generar el QR de pago' });
  }
});

// GET /api/bancard/estado/:hash
// Endpoint liviano para el polling de la pantalla del cliente.
router.get('/estado/:hash', async (req, res) => {
  try {
    const pedido = await pedidoModel.buscarPorHash(req.params.hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({
      success: true,
      estado: pedido.estado,
      pagado: pedido.estado === 'PAGADO',
      bancard_status: pedido.bancard_status || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bancard/pagar-mock/:hash
// PRUEBA (revertible): saltea el pago real del TÓTEM. Marca el pedido PAGADO sin
// pasar por Bancard, para ver el flujo completo tótem → celular → retiro sin pagar.
// Gateado por el flag `bypass_pago_totem` de la tabla configuración (se prende/apaga
// en /admin/configuracion). Apagado por defecto: en prod normal devuelve 403 y no
// afecta al Bancard real de caja/tienda. NO usar con clientes reales.
router.post('/pagar-mock/:hash', async (req, res) => {
  if (!configService.bypassPagoTotem()) {
    return res.status(403).json({ error: 'Bypass de pago no habilitado' });
  }
  try {
    const pedido = await pedidoModel.buscarPorHash(req.params.hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    await confirmarPagoPedido(pedido, { ticket: 'BYPASS', authorization: 'BYPASS-OK' });
    res.json({ success: true, pagado: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bancard/callback
// Notificación de pago desde Bancard. DEBE responder en <5s y con
// Content-Type application/json. Ver doc "Confirmación de un pago".
router.post('/callback', async (req, res) => {
  // Respuestas exactas que espera Bancard.
  const ok = {
    status: 'success',
    messages: [{ level: 'success', key: 'Confirmed', description: 'Pago recibido con exito' }],
  };
  const fail = (description) => ({
    status: 'error',
    messages: [{ level: 'error', key: 'ConfirmedError', description }],
  });

  try {
    // Validación opcional de Basic Auth (si están configuradas las credenciales).
    if (!callbackAuthOk(req)) {
      return res.status(401).json(fail('No autorizado'));
    }

    const payment = req.body?.payment;
    if (!payment?.hook_alias) {
      return res.status(400).json(fail('Payload inválido'));
    }

    // Log de cada callback recibido (hook_alias + resultado) para certificación
    // y diagnóstico: con esto se reportan los hook_alias a Bancard.
    console.log(`[bancard][callback] hook_alias=${payment.hook_alias} status=${payment.status} response_code=${payment.response_code}`);

    const pedido = await pedidoModel.buscarPorHookAlias(payment.hook_alias);
    if (!pedido) {
      return res.status(404).json(fail(`Pedido no encontrado para ${payment.hook_alias}`));
    }

    // Si ya solicitamos la reversa, NO confirmamos: respondemos error (doc, recom. 3).
    // Cubre el escenario 4.2: si llega un confirmed para un QR ya reversado.
    if (pedido.bancard_status === 'revert_requested' || pedido.bancard_status === 'reverted') {
      return res.json(fail('La venta fue cancelada por el comercio'));
    }

    const exito = payment.status === 'confirmed' && payment.response_code === '00';
    if (exito) {
      await confirmarPagoPedido(pedido, {
        ticket: payment.ticket_number != null ? String(payment.ticket_number) : null,
        authorization: payment.authorization_code || null,
      });
    } else {
      // Pago fallido (insuf. fondos u otro): Bancard ya lo reversó de su lado.
      // Acusamos recibo con SUCCESS (escenario 2). El pedido sigue PENDIENTE.
      await pedidoModel.actualizarStatusBancard(pedido.idpedido, 'failed');
    }

    // Recibimos correctamente la notificación (éxito o fallo) → success.
    return res.json(ok);
  } catch (err) {
    // Escenario 4.1: recibimos la confirmación pero NO pudimos finalizar la venta
    // (p. ej. error de DB). Respondemos la estructura de "recepción fallida" en
    // HTTP 200 para que Bancard la lea sin ambigüedad y reverse automáticamente.
    console.error('[bancard] Error en callback (respondemos error → Bancard reversará):', err.message);
    return res.status(200).json(fail('No se pudo procesar la confirmacion'));
  }
});

// POST /api/bancard/revertir  { hash }
// Cancela/reversa el QR de un pedido pendiente (cliente cancela o no llega el
// callback). No tiene efecto sobre pedidos ya pagados.
router.post('/revertir', async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'Hash requerido' });

    const pedido = await pedidoModel.buscarPorHash(hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado === 'PAGADO') {
      return res.status(400).json({ error: 'El pedido ya está pagado, no se puede reversar' });
    }
    if (!pedido.bancard_hook_alias) {
      return res.status(400).json({ error: 'El pedido no tiene un QR generado' });
    }

    // Marcamos la intención antes de invocar: así, si el callback llega en
    // paralelo, respondemos error y no confirmamos una venta cancelada.
    await pedidoModel.actualizarStatusBancard(pedido.idpedido, 'revert_requested');

    // MOCKUP: no hay nada que reversar en Bancard; lo dejamos como reversado.
    if (mockHabilitado()) {
      await pedidoModel.actualizarStatusBancard(pedido.idpedido, 'reverted');
      return res.json({ success: true, mock: true, reverse: 'reverted' });
    }

    console.log(`[bancard][revert] hook_alias=${pedido.bancard_hook_alias} pedido=${pedido.idpedido}`);
    const { httpStatus, body } = await bancard.revertir(pedido.bancard_hook_alias);
    const reverseStatus = body?.reverse?.status || body?.payment?.status || body?.status;
    await pedidoModel.actualizarStatusBancard(pedido.idpedido, 'reverted');

    res.json({ success: true, httpStatus, reverse: reverseStatus, body });
  } catch (err) {
    console.error('[bancard] Error en reversa:', err.message);
    res.status(502).json({ success: false, error: 'No se pudo reversar el pago' });
  }
});

// Confirma el pago de un pedido: lo marca PAGADO con los datos de Bancard y
// dispara la comanda a RETIRO (consumo inmediato del tótem). Lo usan tanto el
// callback real de Bancard como el auto-confirm del mockup, para no divergir.
// Defensivo: si falla el disparo de la comanda, el pago igual queda confirmado
// y al menos se avisa al panel de despacho.
async function confirmarPagoPedido(pedido, { ticket = null, authorization = null } = {}) {
  if (pedido.estado === 'PAGADO') return;
  await pedidoModel.marcarPagadoBancard(pedido.idpedido, { ticket, authorization });

  // NINGÚN origen auto-dispara la comanda a RETIRO al pagarse. El retiro lo pide
  // siempre el cliente explícitamente: la tienda/tótem con el AUTORETIRO desde su
  // celular, y la caja preguntando "¿retirás todo ahora o por partes?" tras cobrar
  // (incluido el QR de caja: cae a la misma pantalla de éxito que pregunta). Así no
  // se prepara comida hasta que alguien la pide de verdad.
}

// ───────────────────────────────────────────────────────────────────────────
// MODO MOCKUP (BANCARD_MOCK=true): no llamamos a Bancard. Se genera un QR
// ficticio y el pago se "confirma" solo tras un retardo, para poder ver TODO el
// proceso (QR → espera → pagado → comanda) sin depender del sandbox externo.
// ───────────────────────────────────────────────────────────────────────────
function mockHabilitado() {
  return String(process.env.BANCARD_MOCK).toLowerCase() === 'true';
}

// Programa la confirmación automática del pago simulado. Re-lee el pedido antes
// de confirmar para respetar una cancelación/reversa hecha mientras esperaba.
function programarConfirmacionMock(idpedido) {
  const delay = Number(process.env.BANCARD_MOCK_DELAY_MS) || 6000;
  const t = setTimeout(async () => {
    try {
      const pedido = await pedidoModel.buscarPorId(idpedido);
      if (!pedido || pedido.estado === 'PAGADO') return;
      if (pedido.bancard_status === 'revert_requested' || pedido.bancard_status === 'reverted') return;
      await confirmarPagoPedido(pedido, { ticket: `MOCK${idpedido}`, authorization: 'MOCK-OK' });
      console.log(`[bancard][mock] Pago simulado confirmado para pedido ${idpedido}`);
    } catch (e) {
      console.error('[bancard][mock] Error confirmando pago simulado:', e.message);
    }
  }, delay);
  if (typeof t.unref === 'function') t.unref(); // no mantener vivo el proceso por el timer
}

// Valida el Basic Auth del callback contra BANCARD_CALLBACK_USER/PASS.
// Si no están configuradas, no se exige (útil al inicio de la integración).
function callbackAuthOk(req) {
  const user = process.env.BANCARD_CALLBACK_USER;
  const pass = process.env.BANCARD_CALLBACK_PASS;
  if (!user && !pass) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  return decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass;
}

// ───────────────────────────────────────────────────────────────────────────
// MOCKUP (sandbox sin Bancard) — usado por /pago/mock. Se mantiene para pruebas
// rápidas del flujo sin depender del servicio externo.
// ───────────────────────────────────────────────────────────────────────────
router.post('/iniciar', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash requerido' });
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json({
    success: true,
    mock: true,
    process_id: `MOCK-${Date.now()}`,
    redirect_url: `/pago/mock?hash=${hash}`,
  });
});

router.post('/confirmar-mock', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash requerido' });
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedido.estado === 'PAGADO') return res.json({ success: true, ya_pagado: true });
  await pedidoModel.marcarPagado(pedido.idpedido);
  res.json({ success: true, message: 'Pago simulado aprobado' });
});

module.exports = router;
