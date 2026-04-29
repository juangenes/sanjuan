const crypto = require('crypto');

function generarHash(idpedido, timestamp) {
  const secreto = process.env.HASH_SECRET;
  return crypto.createHash('sha256').update(`${idpedido}|${timestamp}|${secreto}`).digest('hex');
}

module.exports = { generarHash };
