const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'sanjuan',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  timezone: '-03:00',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
