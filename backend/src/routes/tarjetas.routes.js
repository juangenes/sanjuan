const router = require('express').Router();
const tarjetaModel = require('../models/tarjeta.model');
const { authAdmin, authExpendio } = require('../middleware/auth');

// Público (operador de puesto) — ver saldo
router.get('/:codigo/saldo', authExpendio, async (req, res) => {
  try {
    const tarjeta = await tarjetaModel.buscarPorCodigo(req.params.codigo);
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    const saldo = await tarjetaModel.saldo(tarjeta.id);
    res.json({ success: true, codigo: tarjeta.codigo, saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Operador puesto — consumir crédito FIFO
router.post('/consumir', authExpendio, async (req, res) => {
  try {
    const { codigo, idpuesto } = req.body;
    if (!codigo || !idpuesto) return res.status(400).json({ error: 'Datos incompletos' });
    const tarjeta = await tarjetaModel.buscarPorCodigo(codigo);
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    const valor = await tarjetaModel.consumir(tarjeta.id, idpuesto);
    const saldo = await tarjetaModel.saldo(tarjeta.id);
    res.json({ success: true, valor_cobrado: valor, saldo_restante: saldo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin — cargar créditos
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
