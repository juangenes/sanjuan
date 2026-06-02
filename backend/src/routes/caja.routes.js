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

// ── Lector del celular → caja ────────────────────────────────────────────────
// Registra una lectura escaneada en el celular y la rutea a la caja elegida (RTS).
router.post('/lectura', async (req, res) => {
  try {
    const { caja, codigo } = req.body || {};
    const lectura = await cajaService.registrarLectura({ caja, codigo }, req.user.usuario);
    res.status(201).json({ success: true, lectura });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lecturas pendientes de una caja (la pantalla de caja las levanta al montar).
router.get('/lecturas', async (req, res) => {
  try {
    const lecturas = await cajaService.listarLecturas(req.query.caja);
    res.json({ success: true, lecturas });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// La caja marca una lectura como atendida (la entregó) o descartada.
router.post('/lectura/:id/atendida', async (req, res) => {
  try {
    await cajaService.atenderLectura(req.params.id, req.body?.estado);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
