const crypto = require('crypto');

// Identidad del cliente para el AUTORETIRO = su número de celular. Lo normalizamos
// a los 9 dígitos significativos del móvil paraguayo (sin prefijo país 595 ni el 0
// inicial): "0981-123456", "981123456" y "+595 981 123456" colapsan al mismo
// identificador. Tomar los últimos 9 dígitos cubre los tres formatos de una.
function normalizarTel(s) {
  return (s || '').replace(/\D/g, '').slice(-9);
}

// Firma HMAC de la "bolsa" de un celular. El token resultante es la LLAVE del
// autoretiro: quien lo tiene puede ver y retirar TODOS los pedidos de ese número,
// por eso se entrega únicamente al WhatsApp de ese número. El tel viaja en claro
// (es el del propio dueño); la firma impide forjar el link de otro número sin el
// HASH_SECRET del servidor, así que no se puede enumerar la bolsa ajena.
function firmar(tel9) {
  return crypto
    .createHmac('sha256', process.env.HASH_SECRET || '')
    .update(`bolsa|${tel9}`)
    .digest('hex')
    .slice(0, 16);
}

// Genera el token `tel9.firma` para un celular. Devuelve null si el número no es
// usable (muy corto para ser un celular real).
function generarToken(tel) {
  const tel9 = normalizarTel(tel);
  if (tel9.length < 6) return null;
  return `${tel9}.${firmar(tel9)}`;
}

// Devuelve el tel normalizado si el token es válido, o null. Comparación en tiempo
// constante para no filtrar la firma por timing.
function verificarToken(token) {
  const [tel9, sig] = String(token || '').split('.');
  if (!tel9 || !sig) return null;
  const esperado = firmar(tel9);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return tel9;
}

module.exports = { normalizarTel, generarToken, verificarToken };
