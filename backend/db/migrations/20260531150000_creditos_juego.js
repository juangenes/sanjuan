// Acreditación de créditos contra pedido pagado:
//  - productos.creditos_por_unidad: cuántos créditos de juego entrega cada
//    unidad de un producto JUEGO (combo x10 = 10; juego suelto = 1).
//  - tarjeta_credito.idpedido / idpedido_producto: ata cada carga a la línea
//    de juego del pedido que la pagó (cuadre exacto y dispensación parcial en
//    varias tarjetas). Nullable: las cargas viejas / de emergencia siguen valiendo.

exports.up = async function (knex) {
  await knex.raw(
    'ALTER TABLE `productos` ADD COLUMN `creditos_por_unidad` INT(11) NOT NULL DEFAULT 0'
  );

  await knex.raw(`
    ALTER TABLE \`tarjeta_credito\`
      ADD COLUMN \`idpedido\`           INT(11) DEFAULT NULL,
      ADD COLUMN \`idpedido_producto\`  INT(11) DEFAULT NULL,
      ADD KEY \`fk_tc_pedido\` (\`idpedido\`),
      ADD KEY \`fk_tc_pedido_prod\` (\`idpedido_producto\`),
      ADD CONSTRAINT \`fk_tc_pedido\` FOREIGN KEY (\`idpedido\`)
        REFERENCES \`pedidos\` (\`idpedido\`) ON DELETE SET NULL,
      ADD CONSTRAINT \`fk_tc_pedido_prod\` FOREIGN KEY (\`idpedido_producto\`)
        REFERENCES \`pedidos_productos\` (\`id\`) ON DELETE SET NULL
  `);

  // Combo de Juegos x 10 = 10 créditos por unidad.
  await knex.raw(
    "UPDATE `productos` SET `creditos_por_unidad` = 10 WHERE `idproducto` = 10"
  );

  // Producto "Juego x unidad" para vender créditos sueltos por cantidad libre.
  // Solo si todavía no existe (la migración corre una vez, pero esto la hace
  // idempotente ante re-siembras).
  const [[existe]] = await knex.raw(
    "SELECT idproducto FROM `productos` WHERE titulo = 'Juego x unidad' LIMIT 1"
  );
  if (!existe) {
    await knex.raw(`
      INSERT INTO \`productos\`
        (titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock, creditos_por_unidad)
      VALUES
        ('Juego x unidad', 'Créditos sueltos para los juegos', 'juegos.jpg', 7000, 8000, 1, 'JUEGO', 1000, 1)
    `);
  }
};

exports.down = async function (knex) {
  // No se borra el producto "Juego x unidad": una vez vendido queda referenciado
  // por pedidos (perderíamos historial de ventas y rompería la FK). El rollback
  // solo revierte el esquema; si hace falta, se desactiva el producto a mano.
  await knex.raw(`
    ALTER TABLE \`tarjeta_credito\`
      DROP FOREIGN KEY \`fk_tc_pedido\`,
      DROP FOREIGN KEY \`fk_tc_pedido_prod\`,
      DROP COLUMN \`idpedido\`,
      DROP COLUMN \`idpedido_producto\`
  `);
  await knex.raw('ALTER TABLE `productos` DROP COLUMN `creditos_por_unidad`');
};
