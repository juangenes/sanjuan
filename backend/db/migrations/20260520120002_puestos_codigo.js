// Agrega `codigo` a `puestos`: identificador estable usado en la URL de consumo
// (/tarjetas/:codigo), independiente del id autoincremental. Permite links como
// /tarjetas/6a, /tarjetas/6b, /tarjetas/7 alineados al grado.

const CODIGOS = {
  '1° Grado': '1',
  '2° Grado': '2',
  '3° Grado': '3',
  '4° Grado': '4',
  '5° Grado': '5',
  '6° Grado A': '6a',
  '6° Grado B': '6b',
  '7° Grado': '7',
  '8° Grado': '8',
  '9° Grado': '9',
  '1° Media': '10',
  '2° Media': '11',
  '3° Media': '12',
};

exports.up = async function (knex) {
  await knex.raw(
    'ALTER TABLE `puestos` ADD COLUMN IF NOT EXISTS `codigo` varchar(10) DEFAULT NULL'
  );
  await knex.raw(
    'ALTER TABLE `puestos` ADD UNIQUE KEY IF NOT EXISTS `uq_puestos_codigo` (`codigo`)'
  );
  // Backfill de los puestos por defecto que ya estuvieran cargados.
  for (const [nombre, codigo] of Object.entries(CODIGOS)) {
    await knex('puestos').where({ nombre, codigo: null }).update({ codigo });
  }
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE `puestos` DROP INDEX IF EXISTS `uq_puestos_codigo`');
  await knex.raw('ALTER TABLE `puestos` DROP COLUMN IF EXISTS `codigo`');
};
