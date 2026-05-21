// Tabla de usuarios para autenticación de admin/expendio.
// Reemplaza a backend/migrations/001_usuarios.sql.
// La siembra del admin/expendio inicial la hace bootstrapUsuarios() al arrancar
// la app, leyendo ADMIN_PASS / EXPENDIO_PASS del .env (solo si la tabla está vacía).

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`usuarios\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`usuario\` varchar(50) NOT NULL,
      \`password_hash\` varchar(255) NOT NULL,
      \`rol\` enum('admin','expendio') NOT NULL,
      \`nombre\` varchar(100) DEFAULT NULL,
      \`activo\` tinyint(1) NOT NULL DEFAULT 1,
      \`creado_en\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`ultimo_login\` timestamp NULL DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`usuario\` (\`usuario\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS `usuarios`');
};
