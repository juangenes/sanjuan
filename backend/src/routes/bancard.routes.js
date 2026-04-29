const router = require('express').Router();
const pedidoModel = require('../models/pedido.model');

// MOCKUP — simula respuesta de Bancard aprobada
router.post('/iniciar', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash requerido' });
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  // En producción: llamar a API Bancard, devolver process_id + redirect URL
  res.json({
    success: true,
    mock: true,
    process_id: `MOCK-${Date.now()}`,
    redirect_url: `/pago/mock?hash=${hash}`,
  });
});

// MOCKUP — confirma pago aprobado
router.post('/confirmar-mock', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash requerido' });
  const pedido = await pedidoModel.buscarPorHash(hash);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedido.estado === 'PAGADO') return res.json({ success: true, ya_pagado: true });

  await pedidoModel.marcarPagado(pedido.idpedido);
  res.json({ success: true, message: 'Pago simulado aprobado' });
});

module.exports = router;
