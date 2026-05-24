// Agrega 'POSTRE' al enum `categoria` de la tabla `productos`.
// El orden coloca POSTRE antes de JUEGO para agrupar los consumibles.

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `productos` MODIFY COLUMN `categoria` " +
      "enum('COMIDA','BEBIDA','POSTRE','JUEGO') NOT NULL DEFAULT 'COMIDA'"
  );
};

exports.down = async function (knex) {
  // Revierte productos POSTRE a COMIDA antes de quitar el valor del enum.
  await knex('productos').where({ categoria: 'POSTRE' }).update({ categoria: 'COMIDA' });
  await knex.raw(
    "ALTER TABLE `productos` MODIFY COLUMN `categoria` " +
      "enum('COMIDA','BEBIDA','JUEGO') NOT NULL DEFAULT 'COMIDA'"
  );
};
