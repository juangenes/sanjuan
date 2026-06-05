const router = require('express').Router();
const pedidoService = require('../services/pedido.service');
const pedidoModel = require('../models/pedido.model');
const entregaModel = require('../models/entrega.model');
const expendioService = require('../services/expendio.service');
const configService = require('../services/configuracion.service');
const telToken = require('../utils/telToken');
const { authAdmin, authExpendio } = require('../middleware/auth');
const { notificarDespacho } = require('../utils/rtsClient');

// Público — crear pedido
router.post('/', async (req, res) => {
  try {
    const { cedula, familia, contacto, items, metodo_pago } = req.body;
    if (!familia || !contacto || !items?.length) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const resultado = await pedidoService.crearPedido({ cedula, familia, contacto, items, metodo_pago }, { origen: 'tienda' });
    res.status(201).json({ success: true, ...resultado });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Público (AUTORETIRO agrupado) — "bolsa" de todos los pedidos PAGADOS de un
// celular, identificada por un token firmado (telToken). El link se entrega SOLO
// al WhatsApp de ese número: el canal ES la autenticación. Va ANTES de las rutas
// con comodín `/:hash` para que Express no las capture.
router.get('/bolsa/:token', async (req, res) => {
  try {
    const bolsa = await expendioService.obtenerBolsa(req.params.token);
    if (!bolsa) return res.status(404).json({ error: 'Link inválido o vencido' });
    res.json({ success: true, bolsa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Público (AUTORETIRO agrupado) — dispara a RETIRO los ítems elegidos de la bolsa.
// Igual que /:hash/preparar: gateado por DÍA D (enforcement real, no solo el front).
router.post('/bolsa/:token/preparar', async (req, res) => {
  try {
    if (!configService.diaD()) {
      return res.status(403).json({ error: 'El retiro todavía no está habilitado' });
    }
    const items = (req.body?.items || [])
      .map(i => ({ idproducto: Number(i.idproducto), cantidad: Number(i.cantidad) }))
      .filter(i => i.idproducto && i.cantidad > 0);
    if (!items.length) return res.status(400).json({ error: 'No seleccionaste nada para retirar' });
    const { numeros } = await expendioService.registrarEntregaBolsa(req.params.token, items, 'AUTORETIRO');
    // `numeros` = los #XX que se cantan en el mostrador (uno por pedido afectado).
    res.json({ success: true, numeros });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Operadores (admin / caja / expendio) — genera el link firmado de la bolsa de un
// celular + su resumen, para que un facilitador o cajero se lo envíe por WhatsApp a
// ESE número (único canal de entrega). Minar el token requiere estar logueado: si
// fuera abierto, cualquiera podría generar la bolsa de un número ajeno.
router.get('/bolsa-link/:tel', authExpendio, async (req, res) => {
  try {
    const info = await expendioService.generarLinkBolsa(req.params.tel);
    if (!info) return res.status(400).json({ error: 'Celular inválido' });
    if (info.cantidad === 0) return res.status(404).json({ error: 'No hay pedidos pagados para ese número' });
    res.json({ success: true, ...info });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Público (AUTORETIRO) — el cliente, desde su celular (o el tótem), dispara la
// comanda a RETIRO de los ítems que elige. Seguridad por hash (igual que el resto
// de endpoints públicos del pedido). registrarEntrega ya valida que el pedido esté
// PAGADO y que no se entregue más de lo pedido, así que un doble toque no duplica.
router.post('/:hash/preparar', async (req, res) => {
  try {
    // DÍA D: fuera del día del evento el autoretiro está deshabilitado. El front
    // ya oculta el botón, pero bloqueamos también acá (enforcement real). Se
    // controla desde /admin/configuracion.
    if (!configService.diaD()) {
      return res.status(403).json({ error: 'El retiro todavía no está habilitado' });
    }
    const items = (req.body?.items || [])
      .map(i => ({ idproducto: Number(i.idproducto), cantidad: Number(i.cantidad) }))
      .filter(i => i.idproducto && i.cantidad > 0);
    if (!items.length) return res.status(400).json({ error: 'No seleccionaste nada para preparar' });
    const { idot, comandaId } = await expendioService.registrarEntrega(req.params.hash, items, 'AUTORETIRO');
    // `numero` (= comandaId) es el #XX que se canta en el mostrador. Lo devolvemos
    // para que el celular se lo muestre al cliente apenas dispara el autoretiro.
    res.json({ success: true, idot, numero: comandaId });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    notificarDespacho({ motivo: 'admin-pagar', hash: pedido.hash });
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
