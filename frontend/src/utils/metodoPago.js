// Resuelve, a partir de un pedido, CÓMO se pagó (o cómo se espera pagar).
// La verdad puede vivir en tres lugares según el flujo, así que se prioriza:
//   1) `cobro_metodo`  → cobro real registrado en caja (lo más confiable).
//   2) `bancard_status`→ pago QR online por Bancard (aunque no haya pasado por caja).
//   3) `metodo_pago`   → método declarado al crear el pedido (preventa/tienda).
// Devuelve { label, icon } listo para mostrar; si no hay dato, un guion.

const COBRO = {
  EFECTIVO:      { label: 'Efectivo',      icon: '💵' },
  QR:            { label: 'QR',            icon: '🏦' },
  TARJETA:       { label: 'Tarjeta',       icon: '💳' },
  POS_DEBITO:    { label: 'POS Débito',    icon: '💳' },
  POS_CREDITO:   { label: 'POS Crédito',   icon: '💳' },
  TRANSFERENCIA: { label: 'Transferencia', icon: '↔️' },
};

const METODO = {
  TRANSFERENCIA: { label: 'Transferencia', icon: '↔️' },
  INFONET:       { label: 'Infonet',       icon: '🧾' },
};

export function metodoPago(p) {
  if (!p) return { label: '—', icon: '' };
  if (p.cobro_metodo && COBRO[p.cobro_metodo]) return COBRO[p.cobro_metodo];
  if (p.bancard_status) return { label: 'QR Bancard', icon: '🏦' };
  if (p.metodo_pago && METODO[p.metodo_pago]) return METODO[p.metodo_pago];
  if (p.metodo_pago) return { label: p.metodo_pago, icon: '' };
  return { label: '—', icon: '' };
}
