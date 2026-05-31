const router = require('express').Router();
const expendioService = require('../services/expendio.service');
const pedidoModel = require('../models/pedido.model');
const { authExpendio } = require('../middleware/auth');

router.use(authExpendio);

// Listar todos los pedidos PAGADOS para despacho
router.get('/pedidos', async (req, res) => {
  try {
    const pedidos = await pedidoModel.listarPagados();
    res.json({ success: true, pedidos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Historial de boletas de un pedido
router.get('/historial/:hash', async (req, res) => {
  try {
    const historial = await expendioService.obtenerHistorial(req.params.hash);
    if (!historial) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, historial });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Despacho por estaciones (lector QR → cola de estación) ---

// Listado de estaciones disponibles
router.get('/estaciones', (req, res) => {
  res.json({ success: true, estaciones: expendioService.ESTACIONES });
});

// Rutear un pedido escaneado a una estación
router.post('/enviar', async (req, res) => {
  try {
    const { hash, estacion } = req.body;
    if (!hash || !estacion) return res.status(400).json({ error: 'Datos incompletos' });
    const envio = await expendioService.enviarAEstacion(hash, estacion, req.user.usuario);
    res.json({ success: true, envio });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cola pendiente de una estación (se carga al montar la pantalla)
router.get('/cola/:estacion', async (req, res) => {
  try {
    const cola = await expendioService.obtenerCola(req.params.estacion);
    res.json({ success: true, cola });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Marcar un envío como atendido (sale de la cola)
router.post('/cola/:id/atendido', async (req, res) => {
  try {
    await expendioService.atenderEnvio(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
