const db = require('../config/db');

async function buscarPorCodigo(codigo) {
  const [rows] = await db.query(
    'SELECT * FROM tarjetas WHERE codigo = ?', [codigo]
  );
  return rows[0] || null;
}

async function cargar(idtarjeta, cantidad, valor_unitario, operador) {
  const [result] = await db.query(
    `INSERT INTO tarjeta_credito (idtarjeta, cantidad, valor_unitario, operador)
     VALUES (?, ?, ?, ?)`,
    [idtarjeta, cantidad, valor_unitario, operador]
  );
  return result.insertId;
}

async function saldo(idtarjeta) {
  const [cred] = await db.query(
    'SELECT COALESCE(SUM(cantidad), 0) AS total FROM tarjeta_credito WHERE idtarjeta = ?',
    [idtarjeta]
  );
  const [deb] = await db.query(
    'SELECT COALESCE(SUM(1), 0) AS total FROM tarjeta_debito WHERE idtarjeta = ?',
    [idtarjeta]
  );
  return Number(cred[0].total) - Number(deb[0].total);
}

async function consumir(idtarjeta, idpuesto) {
  // FIFO: tomar el crédito más antiguo no consumido
  const [creditos] = await db.query(
    `SELECT tc.id, tc.valor_unitario
     FROM tarjeta_credito tc
     WHERE tc.idtarjeta = ?
       AND (SELECT COUNT(*) FROM tarjeta_debito td WHERE td.idtarjeta_credito = tc.id) < tc.cantidad
     ORDER BY tc.fecha ASC, tc.id ASC
     LIMIT 1`,
    [idtarjeta]
  );
  if (!creditos.length) throw new Error('Sin saldo disponible');
  const credito = creditos[0];
  await db.query(
    `INSERT INTO tarjeta_debito (idtarjeta, idtarjeta_credito, idpuesto, valor_unitario)
     VALUES (?, ?, ?, ?)`,
    [idtarjeta, credito.id, idpuesto, credito.valor_unitario]
  );
  return credito.valor_unitario;
}

async function movimientos(idtarjeta) {
  const [rows] = await db.query(
    `SELECT 'CARGA' AS tipo, tc.cantidad, tc.valor_unitario, tc.fecha, tc.operador, NULL AS puesto
     FROM tarjeta_credito tc WHERE tc.idtarjeta = ?
     UNION ALL
     SELECT 'CONSUMO', 1, td.valor_unitario, td.fecha, NULL, p.nombre
     FROM tarjeta_debito td
     JOIN puestos p ON td.idpuesto = p.id
     WHERE td.idtarjeta = ?
     ORDER BY fecha DESC`,
    [idtarjeta, idtarjeta]
  );
  return rows;
}

module.exports = { buscarPorCodigo, cargar, saldo, consumir, movimientos };
