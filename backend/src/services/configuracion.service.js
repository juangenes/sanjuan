const configModel = require('../models/configuracion.model');

// Caché en memoria de la tabla `configuracion`. Se carga al boot y se refresca
// al guardar, así los endpoints de alto tráfico (GET /pedidos/:hash, /preparar)
// no pegan a la base por cada request. Una sola instancia PM2, así que alcanza.
let cache = {};

async function cargar() {
  const rows = await configModel.listar();
  cache = {};
  for (const r of rows) cache[r.clave] = r.valor;
  return cache;
}

function getRaw(clave) {
  return cache[clave];
}

function getBool(clave) {
  return cache[clave] === 'true';
}

async function set(clave, valor) {
  await configModel.guardar(clave, String(valor));
  cache[clave] = String(valor);
}

// Atajo del flag más usado: habilita el autoretiro del cliente y el tótem.
function diaD() {
  return getBool('dia_d');
}

module.exports = { cargar, getRaw, getBool, set, diaD, snapshot: () => ({ ...cache }) };
