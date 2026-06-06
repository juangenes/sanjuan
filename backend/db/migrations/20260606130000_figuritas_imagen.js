// Las figuritas ya tienen su foto: frontend/public/img/figuritas.jpg.
// Apuntamos los 3 productos a ese archivo (comparten la misma imagen).

exports.up = async function (knex) {
  await knex.raw(
    "UPDATE `productos` SET `imagen` = 'figuritas.jpg' WHERE `categoria` = 'FIGURITAS'"
  );
};

exports.down = async function (knex) {
  await knex.raw(
    "UPDATE `productos` SET `imagen` = NULL WHERE `categoria` = 'FIGURITAS'"
  );
};
