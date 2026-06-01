const router = require('express').Router();
const cajaService = require('../services/caja.service');
const { authCaja } = require('../middleware/auth');

router.use(authCaja);

// Tomar un pedido nuevo en caja: arma, cobra y deja PAGADO. Devuelve el pedido
// recién creado (idpedido, hash, total, vuelto) para imprimir el ticket.
router.post('/pedido', async (req, res) => {
  try {
    const { nombre, cedula, contacto, items, metodo, recibido } = req.body || {};
    if (!items?.length || !metodo) return res.status(400).json({ error: 'Datos incompletos' });
    const pedido = await cajaService.tomarPedido(
      { nombre, cedula, contacto, items, metodo, recibido },
      req.user.usuario
    );
    res.status(201).json({ success: true, pedido });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Tomar un pedido en caja con pago por QR de Bancard. NO cobra: crea el pedido
// PENDIENTE (precio normal, método INFONET) y devuelve su hash para que el front
// genere el QR. El pago lo confirma el callback de Bancard.
router.post('/pedido-qr', async (req, res) => {
  try {
    const { nombre, cedula, contacto, items } = req.body || {};
    if (!items?.length) return res.status(400).json({ error: 'Datos incompletos' });
    const pedido = await cajaService.tomarPedidoQr({ nombre, cedula, contacto, items });
    res.status(201).json({ success: true, pedido });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
