// Suma el rol 'fotos' al enum de usuarios.rol. Es el rol de los usuarios
// "solo-fotos" (p. ej. el fotógrafo): acceden únicamente a /fotos/admin.
// El acceso a fotos es transversal (cualquier rol entra), pero este rol existe
// para quienes NO deben tener caja/tarjetas/admin. Sigue el patrón de las
// migraciones rol_tarjetas y caja.

exports.up = async function (knex) {
  await knex.raw(
    "ALTER TABLE `usuarios` MODIFY COLUMN `rol` enum('admin','expendio','tarjetas','caja','fotos') NOT NULL"
  );
};

exports.down = async function (knex) {
  // Best-effort: falla si hay usuarios con rol 'fotos'.
  await knex.raw(
    "ALTER TABLE `usuarios` MODIFY COLUMN `rol` enum('admin','expendio','tarjetas','caja') NOT NULL"
  );
};
