const router = require('express').Router();
const pedidoService = require('../services/pedido.service');
const pedidoModel = require('../models/pedido.model');
const entregaModel = require('../models/entrega.model');
const { authAdmin } = require('../middleware/auth');

// Público — crear pedido
router.post('/', async (req, res) => {
  try {
    const { cedula, familia, contacto, items, metodo_pago } = req.body;
    if (!familia || !contacto || !items?.length) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const resultado = await pedidoService.crearPedido({ cedula, familia, contacto, items, metodo_pago });
    res.status(201).json({ success: true, ...resultado });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Público — retiros de un pedido (historial de entregas para el cliente)
router.get('/:hash/retiros', async (req, res) => {
  try {
    const pedido = await pedidoModel.buscarPorHash(req.params.hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const retiros = await entregaModel.retirosPorPedido(pedido.idpedido);
    res.json({ success: true, retiros });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Público — consultar pedido por hash
router.get('/:hash', async (req, res) => {
  try {
    const pedido = await pedidoService.obtenerPedidoPublico(req.params.hash);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ success: true, pedido });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — listar todos
router.get('/', authAdmin, async (req, res) => {
  try {
    const pedidos = await pedidoModel.listarTodos();
    res.json({ success: true, pedidos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — marcar pagado
router.post('/:id/pagar', authAdmin, async (req, res) => {
  try {
    const pedido = await pedidoModel.buscarPorId(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado === 'PAGADO') return res.status(400).json({ error: 'Ya está pagado' });
    await pedidoModel.marcarPagado(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ESTADOS_VALIDOS = ['PENDIENTE', 'PAGADO', 'ANULADO'];

// Admin — editar datos de contacto del pedido (nombre, contacto, cédula)
router.put('/:id', authAdmin, async (req, res) => {
  try {
    const pedido = await pedidoModel.buscarPorId(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const { cedula, familia, contacto, estado } = req.body;
    if (!familia?.trim() || !contacto?.trim()) {
      return res.status(400).json({ error: 'Nombre y contacto son obligatorios' });
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    await pedidoModel.actualizarDatos(req.params.id, {
      cedula: cedula?.trim() || null,
      familia: familia.trim(),
      contacto: contacto.trim(),
    });
    if (estado && estado !== pedido.estado) {
      await pedidoModel.cambiarEstado(req.params.id, estado);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — cambiar estado (anular / restaurar / pagar)
router.post('/:id/estado', authAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const pedido = await pedidoModel.buscarPorId(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    await pedidoModel.cambiarEstado(req.params.id, estado);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — dashboard resumen
router.get('/admin/resumen', authAdmin, async (req, res) => {
  try {
    const dashboard = await pedidoModel.resumenDashboard();
    const porProducto = await pedidoModel.resumenPorProducto();
    res.json({ success: true, dashboard, porProducto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — detalle de ventas por producto (filtrable por rango de fechas)
router.get('/admin/ventas-producto', authAdmin, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const data = await pedidoModel.ventasPorProductoDetalle({ desde, hasta });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
