const router = require('express').Router();
const expendioService = require('../services/expendio.service');
const pedidoModel = require('../models/pedido.model');
const { authExpendio } = require('../middleware/auth');

router.use(authExpendio);

// Listar todos los pedidos PAGADOS (para buscar preventa y ver saldos de retiro)
router.get('/pedidos', async (req, res) => {
  try {
    const pedidos = await pedidoModel.listarPagados();
    res.json({ success: true, pedidos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ver pedido para retiro (por hash) con saldos pendientes
router.get('/pedido/:hash', async (req, res) => {
  try {
    const pedido = await expendioService.obtenerPedidoParaExpendio(req.params.hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, pedido });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Registrar entrega = disparar comanda a RETIRO (la cocina imprime y prepara)
router.post('/entregar', async (req, res) => {
  try {
    const { hash, items } = req.body;
    if (!hash || !items?.length) return res.status(400).json({ error: 'Datos incompletos' });
    const { idot, comandaId } = await expendioService.registrarEntrega(hash, items, req.user.usuario);
    // `numero` (= comandaId) es el #XX que se canta en RETIRO; lo devolvemos para
    // que la caja lo muestre/imprima al despachar un retiro de preventa.
    res.json({ success: true, idot, numero: comandaId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Obtener boleta de una entrega (para reimpresión / consulta)
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

// --- RETIRO (pantalla única que imprime/cuelga las comandas) ---

// Cola de comandas pendientes de imprimir (se carga al montar y ante cada aviso RTS)
router.get('/cola-retiro', async (req, res) => {
  try {
    const cola = await expendioService.obtenerColaRetiro();
    res.json({ success: true, cola });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar una comanda como impresa/colgada (sale de la cola)
router.post('/comanda/:id/impresa', async (req, res) => {
  try {
    await expendioService.marcarComandaImpresa(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
