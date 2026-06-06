// Grupo "Figuritas" para la caja:
//  - Se agrega el valor FIGURITAS al ENUM de productos.categoria (alineado con
//    las categorías que ya usa el frontend: COMIDA/BEBIDA/POSTRE/JUEGO).
//  - Tres productos: normales 2.500, cromadas 5.000, especiales 10.000.
//    Sin imagen propia todavía: imagen NULL => el frontend cae a /img/placeholder.jpg.
//  precio_preventa = precio_normal: la caja cobra a precio NORMAL y no hay preventa
//  diferenciada para figuritas.

const FIGURITAS = [
  ['Figuritas Normales', 'Figuritas del evento', 2500],
  ['Figuritas Cromadas', 'Figuritas con efecto cromado', 5000],
  ['Figuritas Especiales', 'Figuritas edición especial', 10000],
];

exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE \`productos\` MODIFY \`categoria\`
      ENUM('COMIDA','BEBIDA','POSTRE','JUEGO','FIGURITAS') NOT NULL DEFAULT 'COMIDA'
  `);

  // Idempotente ante re-siembras: solo inserta la figurita que falte.
  for (const [titulo, descripcion, precio] of FIGURITAS) {
    const [[existe]] = await knex.raw(
      'SELECT idproducto FROM `productos` WHERE titulo = ? LIMIT 1',
      [titulo]
    );
    if (!existe) {
      await knex.raw(
        `INSERT INTO \`productos\`
           (titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock, creditos_por_unidad)
         VALUES (?, ?, NULL, ?, ?, 1, 'FIGURITAS', 1000, 0)`,
        [titulo, descripcion, precio, precio]
      );
    }
  }
};

exports.down = async function (knex) {
  // Desactivamos las figuritas en vez de borrarlas: una vez vendidas quedan
  // referenciadas por pedidos. Antes de revertir el ENUM hay que sacar las filas
  // que usan FIGURITAS, así que las movemos a COMIDA (inactivas).
  await knex.raw(
    "UPDATE `productos` SET `activo` = 0, `categoria` = 'COMIDA' WHERE `categoria` = 'FIGURITAS'"
  );
  await knex.raw(`
    ALTER TABLE \`productos\` MODIFY \`categoria\`
      ENUM('COMIDA','BEBIDA','POSTRE','JUEGO') NOT NULL DEFAULT 'COMIDA'
  `);
};
