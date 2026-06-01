// La caja cobra con: EFECTIVO, POS_DEBITO, POS_CREDITO. Agrega esos valores al
// enum cobro_metodo (aditivo: conserva los anteriores para no romper filas ya
// guardadas en pruebas).

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `pedidos` MODIFY COLUMN `cobro_metodo` " +
    "enum('EFECTIVO','POS_DEBITO','POS_CREDITO','QR','TARJETA','TRANSFERENCIA') DEFAULT NULL"
  );
};

exports.down = async function (knex) {
  await knex.raw(
    "ALTER TABLE `pedidos` MODIFY COLUMN `cobro_metodo` " +
    "enum('EFECTIVO','QR','TARJETA','TRANSFERENCIA') DEFAULT NULL"
  );
};
