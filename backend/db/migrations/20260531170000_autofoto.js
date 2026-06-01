// AUTO FOTO — galería de fotos del evento.
// El celular del fotógrafo recorta y "hornea" el marco/logo en la imagen antes
// de subirla, así que el backend solo guarda el archivo final y una fila por foto.
//   - publicada: moderación. Sale en el carrusel (TV) y la galería pública solo
//     si publicada=1. Se sube ya publicada (el fotógrafo curó al previsualizar);
//     el panel permite ocultarla/borrarla después si hace falta.
//   - marco: clave del marco usado (solo informativo / estadística).

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE \`fotos\` (
      \`id\`         INT(11)      NOT NULL AUTO_INCREMENT,
      \`archivo\`    VARCHAR(255) NOT NULL,
      \`url\`        VARCHAR(255) NOT NULL,
      \`marco\`      VARCHAR(40)  DEFAULT NULL,
      \`publicada\`  TINYINT(1)   NOT NULL DEFAULT 1,
      \`creado_en\`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_fotos_pub\` (\`publicada\`, \`creado_en\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS `fotos`');
};
