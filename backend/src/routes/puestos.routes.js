const router = require('express').Router();
const puestoModel = require('../models/puesto.model');
const { authAdmin } = require('../middleware/auth');

// Público (stand) — listado de puestos activos para el selector de consumo
router.get('/', async (req, res) => {
  try {
    const puestos = await puestoModel.listarActivos();
    res.json({ success: true, puestos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — listado completo (incluye inactivos)
router.get('/admin', authAdmin, async (req, res) => {
  try {
    const puestos = await puestoModel.listarTodos();
    res.json({ success: true, puestos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — crear
router.post('/', authAdmin, async (req, res) => {
  try {
    const { nombre } = req.body || {};
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const id = await puestoModel.crear(req.body);
    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — editar
router.put('/:id', authAdmin, async (req, res) => {
  try {
    const { nombre } = req.body || {};
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    await puestoModel.actualizar(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — eliminar
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    await puestoModel.eliminar(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'No se puede eliminar: el puesto tiene consumos registrados. Marcalo como inactivo en su lugar.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
