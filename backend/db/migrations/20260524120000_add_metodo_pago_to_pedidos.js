// Agrega `metodo_pago` a `pedidos`: cómo paga el cliente su pedido.
// Valores usados por la app: 'TRANSFERENCIA' (validación manual por WhatsApp)
// e 'INFONET' (confirmación automática, en implementación).

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `pedidos` ADD COLUMN IF NOT EXISTS `metodo_pago` varchar(20) DEFAULT NULL"
  );
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE `pedidos` DROP COLUMN IF EXISTS `metodo_pago`');
};
