// Configuración operativa editable desde /admin/configuracion (clave/valor).
// Reemplaza flags que antes vivían en .env y se togglean en vivo el día del
// evento. Hoy guarda `dia_d` (habilita el autoretiro del cliente y el tótem);
// queda genérica para sumar más flags sin migrar.

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`configuracion\` (
      \`clave\` varchar(64) NOT NULL,
      \`valor\` varchar(255) DEFAULT NULL,
      \`actualizado_en\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (\`clave\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Semilla: el evento arranca deshabilitado (pre-evento). Se prende desde /admin.
  await knex.raw(
    "INSERT IGNORE INTO `configuracion` (`clave`, `valor`) VALUES ('dia_d', 'false')"
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS `configuracion`');
};
