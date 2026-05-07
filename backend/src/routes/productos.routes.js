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

// Admin — eliminar
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    await productoModel.eliminarProducto(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error: 'No se puede eliminar: el producto está referenciado en pedidos. Marcalo como inactivo en su lugar.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
