// Suma el rol 'tarjetas' (operadores de la sección Tarjetas: ver saldo + cargar)
// al enum de usuarios.rol.

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `usuarios` MODIFY COLUMN `rol` enum('admin','expendio','tarjetas') NOT NULL"
  );
};

exports.down = async function (knex) {
  // Best-effort: falla si hay usuarios con rol 'tarjetas'.
  await knex.raw(
    "ALTER TABLE `usuarios` MODIFY COLUMN `rol` enum('admin','expendio') NOT NULL"
  );
};
