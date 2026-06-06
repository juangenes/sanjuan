// Categorías que NO se retiran en el mostrador: no entran a comandas de RETIRO,
// ni al autoretiro, ni cuentan para el saldo de retiro. Los JUEGO se dispensan
// como créditos en la tarjeta (panel de acreditación); las FIGURITAS se entregan
// en mano en la caja al cobrar. Punto ÚNICO para sumar/quitar categorías.
const CATEGORIAS_SIN_RETIRO = ['JUEGO', 'FIGURITAS'];

module.exports = { CATEGORIAS_SIN_RETIRO };
