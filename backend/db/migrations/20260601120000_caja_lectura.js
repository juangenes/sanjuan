// Cola de "lecturas" por caja: cuando el lector del celular escanea el QR de un
// cliente y lo manda a una caja (1..5), se guarda acá. La caja carga sus lecturas
// pendientes por HTTP al montar y el RTS (Socket.IO, scope sanjuan-caja-N) le avisa
// de las nuevas en vivo. Espejo del patrón de `expendio_envios`.

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`caja_lectura\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`caja\` varchar(8) NOT NULL,
      \`codigo\` varchar(255) NOT NULL,
      \`hash\` varchar(64) DEFAULT NULL,
      \`idpedido\` int(11) DEFAULT NULL,
      \`familia\` varchar(150) DEFAULT NULL,
      \`estado\` enum('PENDIENTE','ATENDIDA','DESCARTADA') NOT NULL DEFAULT 'PENDIENTE',
      \`enviado_por\` varchar(50) DEFAULT NULL,
      \`creado_en\` datetime NOT NULL DEFAULT current_timestamp(),
      \`atendido_en\` datetime DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_caja_estado\` (\`caja\`, \`estado\`),
      KEY \`idx_pedido\` (\`idpedido\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS `caja_lectura`');
};
