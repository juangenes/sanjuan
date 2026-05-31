// Cola de despacho por estación: cuando el lector QR rutea un pedido a una
// estación (Expendio 1/2/3), se guarda acá. La estación carga su cola por HTTP
// al montar y el RTS (Socket.IO) le avisa de los nuevos en vivo.

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`expendio_envios\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`idpedido\` int(11) NOT NULL,
      \`estacion\` varchar(40) NOT NULL,
      \`estado\` enum('PENDIENTE','ATENDIDO') NOT NULL DEFAULT 'PENDIENTE',
      \`enviado_por\` varchar(50) DEFAULT NULL,
      \`creado_en\` datetime NOT NULL DEFAULT current_timestamp(),
      \`atendido_en\` datetime DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_estacion_estado\` (\`estacion\`, \`estado\`),
      KEY \`idx_pedido\` (\`idpedido\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS `expendio_envios`');
};
