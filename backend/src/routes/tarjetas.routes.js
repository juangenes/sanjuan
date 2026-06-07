const router = require('express').Router();
const tarjetaModel = require('../models/tarjeta.model');
const puestoModel = require('../models/puesto.model');
const { authAdmin, authTarjetas } = require('../middleware/auth');

// Público (stand) — ver saldo. Sin login: el consumo está abierto a todos los stands.
router.get('/:codigo/saldo', async (req, res) => {
  try {
    const tarjeta = await tarjetaModel.buscarPorCodigo(req.params.codigo);
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    const saldo = await tarjetaModel.saldo(tarjeta.id);
    res.json({ success: true, codigo: tarjeta.codigo, saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Público (stand) — consumir crédito FIFO. Sin login: abierto a todos los stands.
router.post('/consumir', async (req, res) => {
  try {
    const { codigo, idpuesto } = req.body;
    if (!codigo || !idpuesto) return res.status(400).json({ error: 'Datos incompletos' });
    const puesto = await puestoModel.buscarPorId(idpuesto);
    if (!puesto || !puesto.activo) return res.status(400).json({ error: 'Puesto inválido o inactivo' });
    const tarjeta = await tarjetaModel.buscarPorCodigo(codigo);
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    const valor = await tarjetaModel.consumir(tarjeta.id, idpuesto);
    const saldo = await tarjetaModel.saldo(tarjeta.id);
    res.json({ success: true, valor_cobrado: valor, saldo_restante: saldo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Acreditador — pedidos PAGADOS con créditos de juego pendientes de acreditar.
router.get('/pendientes', authTarjetas, async (req, res) => {
  try {
    const pedidos = await tarjetaModel.pedidosConCreditosPendientes();
    res.json({ success: true, pedidos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Acreditador — dispensar créditos de un pedido pagado a una tarjeta física.
// Soporta parciales (varias tarjetas para un mismo pedido).
router.post('/dispensar', authTarjetas, async (req, res) => {
  try {
    const { hash, codigo, cantidad } = req.body;
    if (!hash || !codigo || !cantidad) return res.status(400).json({ error: 'Datos incompletos' });
    const resultado = await tarjetaModel.dispensar(hash, codigo, cantidad, req.user.usuario);
    res.json({ success: true, ...resultado });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin — carga libre de créditos (respaldo de emergencia, sin atar a pedido).
// El flujo normal es POST /dispensar contra un pedido pagado.
router.post('/cargar', authAdmin, async (req, res) => {
  try {
    const { codigo, cantidad, valor_unitario } = req.body;
    if (!codigo || !cantidad || !valor_unitario) return res.status(400).json({ error: 'Datos incompletos' });
    const tarjeta = await tarjetaModel.buscarPorCodigo(codigo);
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    await tarjetaModel.cargar(tarjeta.id, cantidad, valor_unitario, req.user.usuario);
    const saldo = await tarjetaModel.saldo(tarjeta.id);
    res.json({ success: true, saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — reporte de créditos consumidos por puesto (ranking por ingresos).
// Va antes de /:codigo/movimientos: '/admin/...' no es capturado por esa ruta
// (segundo segmento distinto a 'movimientos'), pero lo dejamos explícito acá.
router.get('/admin/consumo-puesto', authAdmin, async (req, res) => {
  try {
    const puestos = await tarjetaModel.consumoPorPuesto();
    const totales = puestos.reduce(
      (a, p) => ({ creditos: a.creditos + Number(p.creditos), valor: a.valor + Number(p.valor) }),
      { creditos: 0, valor: 0 }
    );
    res.json({ success: true, puestos, totales });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — detalle de consumos de un puesto (cada crédito, más reciente primero).
router.get('/admin/consumo-puesto/:idpuesto', authAdmin, async (req, res) => {
  try {
    const data = await tarjetaModel.consumoDetallePuesto(req.params.idpuesto);
    if (!data) return res.status(404).json({ error: 'Puesto no encontrado' });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — cuadre de acreditación (cargado vs consumido vs saldo no consumido).
router.get('/admin/cuadre-acreditacion', authAdmin, async (req, res) => {
  try {
    const data = await tarjetaModel.cuadreAcreditacion();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — historial de movimientos
router.get('/:codigo/movimientos', authAdmin, async (req, res) => {
  try {
    const tarjeta = await tarjetaModel.buscarPorCodigo(req.params.codigo);
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    const movimientos = await tarjetaModel.movimientos(tarjeta.id);
    res.json({ success: true, movimientos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
