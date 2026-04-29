const router = require('express').Router();
const productoModel = require('../models/producto.model');
const { authAdmin } = require('../middleware/auth');

// Público
router.get('/', async (req, res) => {
  try {
    const productos = await productoModel.listarActivos();
    res.json({ success: true, productos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — listado completo con inactivos
router.get('/admin', authAdmin, async (req, res) => {
  try {
    const productos = await productoModel.listarTodos();
    res.json({ success: true, productos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — crear
router.post('/', authAdmin, async (req, res) => {
  try {
    const id = await productoModel.crearProducto(req.body);
    res.status(201).json({ success: true, idproducto: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — editar
router.put('/:id', authAdmin, async (req, res) => {
  try {
    await productoModel.actualizarProducto(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
