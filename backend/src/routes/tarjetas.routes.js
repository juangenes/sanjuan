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

// Sección Tarjetas (admin/tarjetas) — cargar créditos. Requiere login.
router.post('/cargar', authTarjetas, async (req, res) => {
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
