const pedidoService = require('./pedido.service');
const expendioService = require('./expendio.service');

// Caja del día: el cajero arma un pedido nuevo (productos elegidos en el momento),
// cobra en persona y lo deja PAGADO. Usa la lista de precios NORMAL (no preventa).
// Acto único pago+expendio: al cobrar, dispara la comanda a RETIRO (la cocina la
// imprime y la cuelga) y el comensal se lleva su ticket para retirar.
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
  const pedido = await pedidoService.crearPedido(datos, {
    lista: 'normal',
    cobro: { metodo, recibido, operador },
  });

  // Dispara la comanda a RETIRO con todos los ítems. Si falla (RTS/red), NO
  // rompemos el cobro: el pedido ya quedó PAGADO y se puede re-disparar desde el
  // modo "Preventa / Retiro" buscándolo por su código.
  let comanda = false;
  try {
    await expendioService.registrarEntrega(
      pedido.hash,
      items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad })),
      operador
    );
    comanda = true;
  } catch (err) {
    console.error('[caja] cobro OK pero no se disparó la comanda a retiro:', err.message);
  }

  return { ...pedido, comanda };
}

module.exports = { tomarPedido };
