const router = require('express').Router();
const pedidoService = require('../services/pedido.service');

// ───────────────────────────────────────────────────────────────────────────
// Tótem de autoservicio (estilo McDonald's). Público, sin login: es una pantalla
// física en el predio. El comensal arma su pedido y paga con QR de Bancard.
//
// A diferencia de /caja (que cobra en el acto y deja PAGADO), acá creamos el
// pedido PENDIENTE con método INFONET y precio NORMAL del día. El pago lo
// confirma el callback de Bancard; recién ahí el pedido pasa a PAGADO y aparece
// en el panel de despacho. El front genera el QR con POST /api/bancard/qr y
// pollea POST /api/bancard/estado hasta verlo pagado, e imprime el ticket.
// ───────────────────────────────────────────────────────────────────────────

// POST /api/totem/pedido  { items:[{ idproducto, cantidad }], nombre? }
// Crea un pedido PENDIENTE (precio normal, pago INFONET) y devuelve su hash para
// que el front genere el QR de Bancard. No descuenta nada más que el stock.
router.post('/pedido', async (req, res) => {
  try {
    const { items, nombre, contacto } = req.body || {};
    if (!items?.length) return res.status(400).json({ error: 'El pedido no tiene ítems' });

    const datos = {
      cedula: null,
      familia: (nombre && nombre.trim()) || 'Autoservicio',
      // Celular opcional: si el comensal lo carga, su compra entra a la bolsa de
      // autoretiro de ese número (puede retirar después por el link de WhatsApp).
      contacto: (contacto && contacto.trim()) || '',
      metodo_pago: 'INFONET',
      items,
    };

    // Sin `cobro`: el pedido queda PENDIENTE. `lista: 'normal'` = precio del día.
    const pedido = await pedidoService.crearPedido(datos, { lista: 'normal', origen: 'totem' });
    res.status(201).json({ success: true, pedido });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
