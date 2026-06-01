-- Schema completo sanjuan v2
-- Ejecutar en el Droplet: mysql -u produccion -p sanjuan < schema.sql

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "-03:00";

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `productos` (
  `idproducto`      INT(11) NOT NULL AUTO_INCREMENT,
  `titulo`          VARCHAR(100) NOT NULL,
  `descripcion`     TEXT DEFAULT NULL,
  `imagen`          VARCHAR(100) DEFAULT NULL,
  `precio_preventa` INT(11) NOT NULL DEFAULT 0,
  `precio_normal`   INT(11) NOT NULL DEFAULT 0,
  `activo`          TINYINT(1) DEFAULT 1,
  `categoria`       ENUM('COMIDA','BEBIDA','POSTRE','JUEGO') NOT NULL DEFAULT 'COMIDA',
  `stock`           INT(11) NOT NULL DEFAULT 0,
  `creditos_por_unidad` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`idproducto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `pedidos` (
  `idpedido`  INT(11) NOT NULL AUTO_INCREMENT,
  `cedula`    VARCHAR(20) DEFAULT NULL,
  `familia`   VARCHAR(100) DEFAULT NULL,
  `contacto`  VARCHAR(20) DEFAULT NULL,
  `total`     INT(11) DEFAULT NULL,
  `metodo_pago` VARCHAR(20) DEFAULT NULL,
  `fecha`     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `estado`    VARCHAR(20) DEFAULT 'PENDIENTE',
  `hash`      VARCHAR(64) NOT NULL,
  PRIMARY KEY (`idpedido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- PEDIDOS_PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `pedidos_productos` (
  `id`              INT(11) NOT NULL AUTO_INCREMENT,
  `idpedido`        INT(11) DEFAULT NULL,
  `idproducto`      INT(11) NOT NULL,
  `cantidad`        INT(11) DEFAULT NULL,
  `precio_unitario` INT(11) DEFAULT NULL,
  `subtotal`        INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pp_pedido` (`idpedido`),
  KEY `fk_pp_producto` (`idproducto`),
  CONSTRAINT `fk_pp_pedido` FOREIGN KEY (`idpedido`) REFERENCES `pedidos` (`idpedido`) ON DELETE CASCADE,
  CONSTRAINT `fk_pp_producto` FOREIGN KEY (`idproducto`) REFERENCES `productos` (`idproducto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- PEDIDOS_ENTREGAS (módulo expendio)
-- ============================================================
CREATE TABLE IF NOT EXISTS `pedidos_entregas` (
  `id`         INT(11) NOT NULL AUTO_INCREMENT,
  `idpedido`   INT(11) NOT NULL,
  `idproducto` INT(11) NOT NULL,
  `cantidad`   INT(11) NOT NULL,
  `idot`       VARCHAR(36) DEFAULT NULL,
  `operador`   VARCHAR(100) DEFAULT NULL,
  `fecha`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_pe_pedido` (`idpedido`),
  KEY `fk_pe_producto` (`idproducto`),
  CONSTRAINT `fk_pe_pedido` FOREIGN KEY (`idpedido`) REFERENCES `pedidos` (`idpedido`) ON DELETE CASCADE,
  CONSTRAINT `fk_pe_producto` FOREIGN KEY (`idproducto`) REFERENCES `productos` (`idproducto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- PUESTOS (para tarjetas FIFO)
-- ============================================================
CREATE TABLE IF NOT EXISTS `puestos` (
  `id`           INT(11) NOT NULL AUTO_INCREMENT,
  `nombre`       VARCHAR(100) NOT NULL,
  `responsable`  VARCHAR(100) DEFAULT NULL,
  `activo`       TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- TARJETAS
-- ============================================================
CREATE TABLE IF NOT EXISTS `tarjetas` (
  `id`      INT(11) NOT NULL AUTO_INCREMENT,
  `codigo`  VARCHAR(20) NOT NULL UNIQUE,
  `activo`  TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- TARJETA_CREDITO (cargas)
-- ============================================================
CREATE TABLE IF NOT EXISTS `tarjeta_credito` (
  `id`            INT(11) NOT NULL AUTO_INCREMENT,
  `idtarjeta`     INT(11) NOT NULL,
  `cantidad`      INT(11) NOT NULL,
  `valor_unitario` INT(11) NOT NULL,
  `operador`      VARCHAR(100) DEFAULT NULL,
  `idpedido`          INT(11) DEFAULT NULL,
  `idpedido_producto` INT(11) DEFAULT NULL,
  `fecha`         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_tc_tarjeta` (`idtarjeta`),
  KEY `fk_tc_pedido` (`idpedido`),
  KEY `fk_tc_pedido_prod` (`idpedido_producto`),
  CONSTRAINT `fk_tc_tarjeta` FOREIGN KEY (`idtarjeta`) REFERENCES `tarjetas` (`id`),
  CONSTRAINT `fk_tc_pedido` FOREIGN KEY (`idpedido`) REFERENCES `pedidos` (`idpedido`) ON DELETE SET NULL,
  CONSTRAINT `fk_tc_pedido_prod` FOREIGN KEY (`idpedido_producto`) REFERENCES `pedidos_productos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- TARJETA_DEBITO (consumos FIFO por puesto)
-- ============================================================
CREATE TABLE IF NOT EXISTS `tarjeta_debito` (
  `id`                INT(11) NOT NULL AUTO_INCREMENT,
  `idtarjeta`         INT(11) NOT NULL,
  `idtarjeta_credito` INT(11) NOT NULL,
  `idpuesto`          INT(11) NOT NULL,
  `valor_unitario`    INT(11) NOT NULL,
  `fecha`             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_td_tarjeta` (`idtarjeta`),
  KEY `fk_td_credito` (`idtarjeta_credito`),
  KEY `fk_td_puesto` (`idpuesto`),
  CONSTRAINT `fk_td_tarjeta` FOREIGN KEY (`idtarjeta`) REFERENCES `tarjetas` (`id`),
  CONSTRAINT `fk_td_credito` FOREIGN KEY (`idtarjeta_credito`) REFERENCES `tarjeta_credito` (`id`),
  CONSTRAINT `fk_td_puesto` FOREIGN KEY (`idpuesto`) REFERENCES `puestos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- DATOS INICIALES — productos (migrados del dump original)
-- ============================================================
INSERT IGNORE INTO `productos` (idproducto, titulo, descripcion, imagen, precio_preventa, precio_normal, activo, categoria, stock, creditos_por_unidad) VALUES
(1,  'Mbeju x unidad',              'Tradicional receta paraguaya',                   'mbeju.jpg',         7000, 8000, 1, 'COMIDA', 100, 0),
(2,  'Pastel Mandio x unidad',       'Delicioso pastel de mandioca',                   'pastel.jpg',        7000, 8000, 1, 'COMIDA', 100, 0),
(3,  'Pajagua Mascada x unidad',     'Clásico plato frito de carne molida y mandioca', 'pajagua.jpg',       7000, 8000, 1, 'COMIDA', 100, 0),
(4,  'Pancho x unidad',              'Pancho en pan con aderezos',                     'pancho.jpg',        7000, 8000, 1, 'COMIDA', 100, 0),
(5,  'Asadito de Carne con mandioca x unidad',    'Brocheta de carne a la parrilla',                'asadito_carne.jpg', 9000,10000, 1, 'COMIDA', 80, 0),
(6,  'Asadito de Pollo con mandioca x unidad',    'Brocheta de pollo a la parrilla',                'asadito_pollo.jpg', 9000,10000, 1, 'COMIDA', 80, 0),
(7,  'Costillita de Cerdo con mandioca x unidad', 'Brocheta de cerdo bien dorada',                  'asadito_cerdo.jpg', 9000,10000, 1, 'COMIDA', 80, 0),
(8,  'Butifarra x unidad',           'Clásica butifarra parrillera',                   'butifarra.jpg',     9000,10000, 1, 'COMIDA', 80, 0),
(9,  'Vori vori de pollo x plato',   'La mejor sopa del mundo',                        'vori.jpg',         30000,    0, 1, 'COMIDA', 50, 0),
(10, 'Combo de Juegos x 10 unidades','Para divertirse en familia',                     'juegos.jpg',       50000,70000, 1, 'JUEGO',  200, 10),
(11, 'Juego x unidad',               'Créditos sueltos para los juegos',               'juegos.jpg',        7000, 8000, 1, 'JUEGO', 1000, 1),
(12, 'Gaseosa 500ml',                'Productos Coca-Cola',                            'coca.jpg',         10000,10000, 1, 'BEBIDA', 150, 0),
(13, 'Agua 500ml',                   'Productos Coca-Cola',                            'agua.jpg',          5000, 5000, 1, 'BEBIDA', 150, 0),
(15, 'Jugo Purosol 200ml x unidad',  'Para acompañar tus comidas',                     'purosol.jpg',       5000, 5000, 1, 'BEBIDA', 100, 0);

-- Puesto de ejemplo
INSERT IGNORE INTO `puestos` (id, nombre, responsable) VALUES (1, 'Juegos Principal', 'Operador 1');
