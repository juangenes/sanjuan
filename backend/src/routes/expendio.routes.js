const router = require('express').Router();
const expendioService = require('../services/expendio.service');
const { authExpendio } = require('../middleware/auth');

router.use(authExpendio);

// Ver pedido para despacho (por hash)
router.get('/pedido/:hash', async (req, res) => {
  try {
    const pedido = await expendioService.obtenerPedidoParaExpendio(req.params.hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, pedido });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Registrar entrega
router.post('/entregar', async (req, res) => {
  try {
    const { hash, items } = req.body;
    if (!hash || !items?.length) return res.status(400).json({ error: 'Datos incompletos' });
    const idot = await expendioService.registrarEntrega(hash, items, req.user.usuario);
    res.json({ success: true, idot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Obtener boleta de una entrega
router.get('/boleta/:hash/:idot', async (req, res) => {
  try {
    const boleta = await expendioService.obtenerBoleta(req.params.hash, req.params.idot);
    if (!boleta) return res.status(404).json({ error: 'Boleta no encontrada' });
    res.json({ success: true, boleta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
