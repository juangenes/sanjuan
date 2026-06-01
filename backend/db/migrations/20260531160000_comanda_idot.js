// Modelo "fast food": cada comanda enviada a RETIRO corresponde a una entrega
// concreta (un idot de pedidos_entregas). Agregamos `idot` a expendio_envios para
// que la pantalla de retiro sepa exactamente qué ítems imprimir/colgar por comanda
// (un pedido de preventa puede generar varias comandas en retiros parciales).

exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('expendio_envios', 'idot');
  if (!has) {
    await knex.raw(
      "ALTER TABLE `expendio_envios` ADD COLUMN `idot` varchar(64) DEFAULT NULL AFTER `idpedido`"
    );
    await knex.raw('CREATE INDEX `idx_idot` ON `expendio_envios` (`idot`)');
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('expendio_envios', 'idot');
  if (has) {
    await knex.raw('DROP INDEX `idx_idot` ON `expendio_envios`');
    await knex.raw('ALTER TABLE `expendio_envios` DROP COLUMN `idot`');
  }
};
