// Campos para el pago con QR de Bancard/Infonet (método de pago 'INFONET').
// Al generar el QR guardamos su identificador (hook_alias), la cadena EMVCo
// (qr_data, para dibujar el QR) y la URL del PNG que devuelve Bancard.
// Cuando llega el callback de notificación guardamos el resultado crudo
// (bancard_status) más el ticket y el código de autorización para conciliar.

exports.up = async function (knex) {
  const cols = [
    "ADD COLUMN IF NOT EXISTS `bancard_hook_alias` varchar(50) DEFAULT NULL",
    "ADD COLUMN IF NOT EXISTS `bancard_qr_data` text DEFAULT NULL",
    "ADD COLUMN IF NOT EXISTS `bancard_qr_url` varchar(255) DEFAULT NULL",
    "ADD COLUMN IF NOT EXISTS `bancard_status` varchar(20) DEFAULT NULL",
    "ADD COLUMN IF NOT EXISTS `bancard_ticket` varchar(50) DEFAULT NULL",
    "ADD COLUMN IF NOT EXISTS `bancard_authorization` varchar(50) DEFAULT NULL",
  ];
  await knex.raw(`ALTER TABLE \`pedidos\` ${cols.join(', ')}`);
  // Búsqueda por hook_alias desde el callback de Bancard.
  await knex.raw(
    'ALTER TABLE `pedidos` ADD INDEX IF NOT EXISTS `ix_pedidos_hook_alias` (`bancard_hook_alias`)'
  );
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE `pedidos` DROP INDEX IF EXISTS `ix_pedidos_hook_alias`');
  const cols = [
    'DROP COLUMN IF EXISTS `bancard_hook_alias`',
    'DROP COLUMN IF EXISTS `bancard_qr_data`',
    'DROP COLUMN IF EXISTS `bancard_qr_url`',
    'DROP COLUMN IF EXISTS `bancard_status`',
    'DROP COLUMN IF EXISTS `bancard_ticket`',
    'DROP COLUMN IF EXISTS `bancard_authorization`',
  ];
  await knex.raw(`ALTER TABLE \`pedidos\` ${cols.join(', ')}`);
};
