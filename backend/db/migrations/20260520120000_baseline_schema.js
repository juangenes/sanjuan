// Baseline: esquema actual de San Juan (productos, puestos, pedidos, tarjetas…).
// Usa CREATE TABLE IF NOT EXISTS para ser seguro en bases que YA tienen las
// tablas (sanjuan, sanjuan_test): en esas no crea nada y solo se marca como
// aplicada. En una base vacía crea todo el esquema desde cero.

const TABLES_UP = [
  `CREATE TABLE IF NOT EXISTS \`productos\` (
    \`idproducto\` int(11) NOT NULL AUTO_INCREMENT,
    \`titulo\` varchar(100) NOT NULL,
    \`descripcion\` text DEFAULT NULL,
    \`imagen\` varchar(100) DEFAULT NULL,
    \`precio_preventa\` int(11) NOT NULL DEFAULT 0,
    \`precio_normal\` int(11) NOT NULL DEFAULT 0,
    \`activo\` tinyint(1) DEFAULT 1,
    \`categoria\` enum('COMIDA','BEBIDA','JUEGO') NOT NULL DEFAULT 'COMIDA',
    \`stock\` int(11) NOT NULL DEFAULT 0,
    PRIMARY KEY (\`idproducto\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`puestos\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`nombre\` varchar(100) NOT NULL,
    \`responsable\` varchar(100) DEFAULT NULL,
    \`activo\` tinyint(1) DEFAULT 1,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`pedidos\` (
    \`idpedido\` int(11) NOT NULL AUTO_INCREMENT,
    \`cedula\` varchar(20) DEFAULT NULL,
    \`familia\` varchar(100) DEFAULT NULL,
    \`contacto\` varchar(20) DEFAULT NULL,
    \`total\` int(11) DEFAULT NULL,
    \`fecha\` timestamp NULL DEFAULT current_timestamp(),
    \`estado\` varchar(20) DEFAULT 'PENDIENTE',
    \`hash\` varchar(64) NOT NULL,
    PRIMARY KEY (\`idpedido\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`pedidos_productos\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`idpedido\` int(11) DEFAULT NULL,
    \`idproducto\` int(11) NOT NULL,
    \`cantidad\` int(11) DEFAULT NULL,
    \`precio_unitario\` int(11) DEFAULT NULL,
    \`subtotal\` int(11) DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`fk_pp_pedido\` (\`idpedido\`),
    KEY \`fk_pp_producto\` (\`idproducto\`),
    CONSTRAINT \`fk_pp_pedido\` FOREIGN KEY (\`idpedido\`) REFERENCES \`pedidos\` (\`idpedido\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_pp_producto\` FOREIGN KEY (\`idproducto\`) REFERENCES \`productos\` (\`idproducto\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`pedidos_entregas\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`idpedido\` int(11) NOT NULL,
    \`idproducto\` int(11) NOT NULL,
    \`cantidad\` int(11) NOT NULL,
    \`idot\` varchar(36) DEFAULT NULL,
    \`operador\` varchar(100) DEFAULT NULL,
    \`fecha\` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (\`id\`),
    KEY \`fk_pe_pedido\` (\`idpedido\`),
    KEY \`fk_pe_producto\` (\`idproducto\`),
    CONSTRAINT \`fk_pe_pedido\` FOREIGN KEY (\`idpedido\`) REFERENCES \`pedidos\` (\`idpedido\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_pe_producto\` FOREIGN KEY (\`idproducto\`) REFERENCES \`productos\` (\`idproducto\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`tarjetas\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`codigo\` varchar(20) NOT NULL,
    \`activo\` tinyint(1) DEFAULT 1,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_codigo\` (\`codigo\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`tarjeta_credito\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`idtarjeta\` int(11) NOT NULL,
    \`cantidad\` int(11) NOT NULL,
    \`valor_unitario\` int(11) NOT NULL,
    \`operador\` varchar(100) DEFAULT NULL,
    \`fecha\` timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (\`id\`),
    KEY \`fk_tc_tarjeta\` (\`idtarjeta\`),
    CONSTRAINT \`fk_tc_tarjeta\` FOREIGN KEY (\`idtarjeta\`) REFERENCES \`tarjetas\` (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS \`tarjeta_debito\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`idtarjeta\` int(11) NOT NULL,
    \`idtarjeta_credito\` int(11) NOT NULL,
    \`idpuesto\` int(11) NOT NULL,
    \`valor_unitario\` int(11) NOT NULL,
    \`fecha\` timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (\`id\`),
    KEY \`fk_td_tarjeta\` (\`idtarjeta\`),
    KEY \`fk_td_credito\` (\`idtarjeta_credito\`),
    KEY \`fk_td_puesto\` (\`idpuesto\`),
    CONSTRAINT \`fk_td_tarjeta\` FOREIGN KEY (\`idtarjeta\`) REFERENCES \`tarjetas\` (\`id\`),
    CONSTRAINT \`fk_td_credito\` FOREIGN KEY (\`idtarjeta_credito\`) REFERENCES \`tarjeta_credito\` (\`id\`),
    CONSTRAINT \`fk_td_puesto\` FOREIGN KEY (\`idpuesto\`) REFERENCES \`puestos\` (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
];

// Orden inverso para el rollback (respeta dependencias de claves foráneas).
const TABLES_DOWN = [
  'tarjeta_debito',
  'tarjeta_credito',
  'tarjetas',
  'pedidos_entregas',
  'pedidos_productos',
  'pedidos',
  'puestos',
  'productos',
];

exports.up = async function (knex) {
  for (const sql of TABLES_UP) {
    await knex.raw(sql);
  }
};

exports.down = async function (knex) {
  for (const t of TABLES_DOWN) {
    await knex.raw(`DROP TABLE IF EXISTS \`${t}\``);
  }
};
