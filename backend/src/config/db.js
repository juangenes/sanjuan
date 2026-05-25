const mysql = require('mysql2/promise');

require('dotenv').config({ override: true });

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'sanjuan',
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      // La BD (droplet) corre en UTC y las columnas TIMESTAMP se guardan/leen en UTC.
      // Le indicamos a mysql2 que interprete los datetime como UTC para construir
      // el instante correcto; el frontend lo convierte a hora local (Asunción) al mostrar.
      timezone: 'Z',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

module.exports = {
  query: (...args) => getPool().query(...args),
  getConnection: () => getPool().getConnection(),
};
