// Caja (POS físico del evento):
//  - suma el rol 'caja' al enum de usuarios.rol (operadores de cobro)
//  - agrega a `pedidos` las columnas del cobro en caja: método, monto recibido
//    (para calcular vuelto en efectivo), fecha y operador que cobró.

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `usuarios` MODIFY COLUMN `rol` enum('admin','expendio','tarjetas','caja') NOT NULL"
  );
  await knex.raw(`
    ALTER TABLE \`pedidos\`
      ADD COLUMN \`cobro_metodo\`   enum('EFECTIVO','QR','TARJETA','TRANSFERENCIA') DEFAULT NULL,
      ADD COLUMN \`cobro_recibido\` decimal(12,2) DEFAULT NULL,
      ADD COLUMN \`cobro_fecha\`    datetime DEFAULT NULL,
      ADD COLUMN \`cobro_operador\` varchar(50) DEFAULT NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE \`pedidos\`
      DROP COLUMN \`cobro_metodo\`,
      DROP COLUMN \`cobro_recibido\`,
      DROP COLUMN \`cobro_fecha\`,
      DROP COLUMN \`cobro_operador\`
  `);
  // Best-effort: falla si hay usuarios con rol 'caja'.
  await knex.raw(
    "ALTER TABLE `usuarios` MODIFY COLUMN `rol` enum('admin','expendio','tarjetas') NOT NULL"
  );
};
