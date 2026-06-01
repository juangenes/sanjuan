const router = require('express').Router();
const pedidoModel = require('../models/pedido.model');
const pedidoProductoModel = require('../models/pedidoProducto.model');
const expendioService = require('../services/expendio.service');
const bancard = require('../services/bancard.service');
const { notificarDespacho } = require('../utils/rtsClient');

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
    const { qr_express, supported_clients } = await bancard.generarQr({
      amount,
      description: `Pedido ${hash.substring(0, 8).toUpperCase()} - San Juan`,
    });

    await pedidoModel.guardarQrBancard(pedido.idpedido, {
      hookAlias: qr_express.hook_alias,
      qrData: qr_express.qr_data,
      qrUrl: qr_express.url,
    });

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

    const pedido = await pedidoModel.buscarPorHookAlias(payment.hook_alias);
    if (!pedido) {
      return res.status(404).json(fail(`Pedido no encontrado para ${payment.hook_alias}`));
    }

    // Si ya solicitamos la reversa, NO confirmamos: respondemos error (doc, recom. 3).
    if (pedido.bancard_status === 'revert_requested' || pedido.bancard_status === 'reverted') {
      return res.json(fail('La venta fue cancelada por el comercio'));
    }

    const exito = payment.status === 'confirmed' && payment.response_code === '00';
    if (exito) {
      if (pedido.estado !== 'PAGADO') {
        await pedidoModel.marcarPagadoBancard(pedido.idpedido, {
          ticket: payment.ticket_number != null ? String(payment.ticket_number) : null,
          authorization: payment.authorization_code || null,
        });
        // Pago QR acreditado (tótem): consumo inmediato → disparar la comanda a
        // RETIRO con todos los ítems (la cocina imprime y prepara; el comensal
        // retira mostrando el QR de su celular). Defensivo: si falla, el pago igual
        // quedó confirmado y la comanda puede re-dispararse desde caja.
        try {
          const items = await pedidoProductoModel.obtenerPorPedido(pedido.idpedido);
          await expendioService.registrarEntrega(
            pedido.hash,
            items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad })),
            'totem'
          );
        } catch (e) {
          console.error('[bancard] pago OK pero no se disparó la comanda a retiro:', e.message);
          // Avisar al menos al panel de despacho para que aparezca el pedido pagado.
          notificarDespacho({ motivo: 'bancard', hash: pedido.hash });
        }
      }
    } else {
      // Pago rechazado: registramos el resultado, el pedido sigue PENDIENTE.
      await pedidoModel.actualizarStatusBancard(pedido.idpedido, 'failed');
    }

    // En ambos casos recibimos correctamente la notificación → success.
    return res.json(ok);
  } catch (err) {
    console.error('[bancard] Error en callback:', err.message);
    return res.status(500).json(fail('No se pudo procesar la confirmacion'));
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

    const { httpStatus, body } = await bancard.revertir(pedido.bancard_hook_alias);
    const reverseStatus = body?.reverse?.status || body?.payment?.status || body?.status;
    await pedidoModel.actualizarStatusBancard(pedido.idpedido, 'reverted');

    res.json({ success: true, httpStatus, reverse: reverseStatus, body });
  } catch (err) {
    console.error('[bancard] Error en reversa:', err.message);
    res.status(502).json({ success: false, error: 'No se pudo reversar el pago' });
  }
});

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
