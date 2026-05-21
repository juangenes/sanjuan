// Configuración de knex — usado SOLO para migraciones de esquema.
// El acceso a datos de la app sigue con mysql2 (src/config/db.js).
//
// La base destino se toma de DB_NAME en el .env. Para correr contra otra base
// sin editar el .env, sobreescribí la variable en la línea de comando, p.ej.:
//   bash:        DB_NAME=sanjuan_test npm run migrate
//   powershell:  $env:DB_NAME='sanjuan_test'; npm run migrate
require('dotenv').config();

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'sanjuan',
  timezone: '-03:00',
};

const config = {
  client: 'mysql2',
  connection,
  migrations: {
    directory: './db/migrations',
    tableName: 'knex_migrations',
  },
  pool: { min: 0, max: 5 },
};

// Mismo config para todos los entornos: lo que cambia es DB_NAME del .env.
module.exports = {
  development: config,
  production: config,
};
