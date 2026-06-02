const router = require('express').Router();
const configService = require('../services/configuracion.service');
const { authAdmin } = require('../middleware/auth');

// Público — config que necesita el front sin login (tótem, /pedido/:hash).
// Solo expone flags no sensibles. Hoy: dia_d (habilita el autoretiro).
router.get('/', (req, res) => {
  res.json({ dia_d: configService.diaD() });
});

// Admin — ver toda la configuración (para la pantalla /admin/configuracion).
router.get('/admin', authAdmin, (req, res) => {
  res.json({ success: true, config: configService.snapshot() });
});

// Admin — guardar una clave. Body: { clave, valor }.
router.put('/', authAdmin, async (req, res) => {
  try {
    const { clave, valor } = req.body || {};
    if (!clave) return res.status(400).json({ error: 'Falta la clave' });
    await configService.set(clave, valor);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
