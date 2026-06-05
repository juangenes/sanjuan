// Alinea la colación de `expendio_envios.idot` con `pedidos_entregas.idot`
// (utf8mb4_general_ci). Las dos columnas `idot` quedaron con colaciones distintas
// (esta se creó como unicode_ci en 20260531160000_comanda_idot), así que el JOIN por
// idot en `retirosPorPedido` lanzaba "Illegal mix of collations" y reventaba la
// consulta de retiros del cliente. Con ambas en la misma colación, el JOIN funciona
// sin COLLATE explícito. El índice `idx_idot` se reconstruye solo al modificar la columna.

exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('expendio_envios', 'idot');
  if (has) {
    await knex.raw(
      'ALTER TABLE `expendio_envios` MODIFY `idot` varchar(64) ' +
      'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL'
    );
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('expendio_envios', 'idot');
  if (has) {
    await knex.raw(
      'ALTER TABLE `expendio_envios` MODIFY `idot` varchar(64) ' +
      'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL'
    );
  }
};
