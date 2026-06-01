// Origen del pedido: de qué canal nació ('tienda' online, 'caja', 'totem').
// Sirve para etiquetar la comanda a RETIRO cuando el pago lo confirma el callback
// de Bancard (que no sabe por sí mismo desde dónde se generó el QR). Nullable:
// los pedidos viejos quedan en NULL y el callback cae a 'totem' por defecto.

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `pedidos` ADD COLUMN IF NOT EXISTS `origen` varchar(20) DEFAULT NULL"
  );
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE `pedidos` DROP COLUMN IF EXISTS `origen`');
};
