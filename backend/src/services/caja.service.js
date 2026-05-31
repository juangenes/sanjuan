const pedidoService = require('./pedido.service');

// Caja del día: el cajero arma un pedido nuevo (productos elegidos en el momento),
// cobra en persona y lo deja PAGADO. Usa la lista de precios NORMAL (no preventa).
async function tomarPedido({ nombre, cedula, contacto, items, metodo, recibido }, operador) {
  if (!items?.length) throw new Error('El pedido no tiene ítems');

  const datos = {
    cedula: cedula?.trim() || null,
    familia: (nombre && nombre.trim()) || 'Mostrador',
    contacto: contacto?.trim() || '',
    metodo_pago: metodo,
    items,
  };

  // crearPedido valida stock, calcula el total con precio normal, cobra y deja
  // el pedido PAGADO de forma transaccional. Devuelve { idpedido, hash, total, vuelto }.
  return pedidoService.crearPedido(datos, {
    lista: 'normal',
    cobro: { metodo, recibido, operador },
  });
}

module.exports = { tomarPedido };
