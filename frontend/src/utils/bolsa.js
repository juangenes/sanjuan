// Helpers de la "bolsa" de autoretiro (link único por celular). Compartidos entre
// el panel de admin y el de caja, así el mensaje de WhatsApp es idéntico en ambos.

// Normaliza un celular a su forma comparable: solo dígitos, sin prefijo país (595)
// ni el 0 inicial. Así "0981123456", "981123456" y "595981123456" coinciden.
export function normNum(s) {
  return (s || '').replace(/\D/g, '').replace(/^595/, '').replace(/^0/, '');
}

// Arma el wa.me con el link ÚNICO y VIVO de la bolsa del cliente, para enviárselo a
// su propio número. Ese link es la llave: agrupa todos sus pedidos pagados y permite
// retirarlos; por eso incluye la advertencia de no compartirlo. `info` viene del
// endpoint /pedidos/bolsa-link/:tel ({ token, familia, cantidad, total }).
export function waLinkBolsa(numNorm, { token, familia, cantidad, total }) {
  const url = `https://sanjuandicequesi.com/mis/${token}`;
  const hola = familia ? `Hola ${familia}! ` : '';
  const msg =
    `*SAN JUAN DICE QUE SI 2026*\n\n` +
    `${hola}Acá tenés el acceso a TODOS tus pedidos (${cantidad}) para retirar:\n\n` +
    `🔗 ${url}\n\n` +
    `Total: Gs. ${Number(total || 0).toLocaleString()}\n\n` +
    `⚠️ Este link es personal: si lo compartís, cualquiera podrá retirar tus pedidos. No lo reenvíes.`;
  return `https://wa.me/595${numNorm}?text=${encodeURIComponent(msg)}`;
}
