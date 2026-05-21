const Puesto = require('../models/puesto.model');

// Puestos por defecto: un puesto por grado (6º se divide en A y B).
// El `codigo` es el identificador usado en la URL de consumo (/tarjetas/:codigo),
// alineado al grado (6a/6b para sexto, 10/11/12 para la media).
const PUESTOS_DEFAULT = [
  { codigo: '1',  nombre: '1° Grado' },
  { codigo: '2',  nombre: '2° Grado' },
  { codigo: '3',  nombre: '3° Grado' },
  { codigo: '4',  nombre: '4° Grado' },
  { codigo: '5',  nombre: '5° Grado' },
  { codigo: '6a', nombre: '6° Grado A' },
  { codigo: '6b', nombre: '6° Grado B' },
  { codigo: '7',  nombre: '7° Grado' },
  { codigo: '8',  nombre: '8° Grado' },
  { codigo: '9',  nombre: '9° Grado' },
  { codigo: '10', nombre: '1° Media' },
  { codigo: '11', nombre: '2° Media' },
  { codigo: '12', nombre: '3° Media' },
];

// Si la tabla `puestos` está vacía, siembra los puestos por defecto.
// Sólo corre una vez (mientras no haya puestos); luego se gestionan desde el ABM.
async function bootstrapPuestos() {
  let puestos;
  try {
    puestos = await Puesto.listarTodos();
  } catch (e) {
    if (e && e.code === 'ER_NO_SUCH_TABLE') {
      console.error(
        '[bootstrap] La tabla `puestos` no existe. Corré las migraciones:\n' +
        '            cd backend && npm run migrate'
      );
      return;
    }
    throw e;
  }

  if (puestos.length > 0) return;

  for (const { codigo, nombre } of PUESTOS_DEFAULT) {
    await Puesto.crear({ codigo, nombre, activo: 1 });
  }
  console.log(`[bootstrap] Sembrados ${PUESTOS_DEFAULT.length} puestos por defecto.`);
}

module.exports = { bootstrapPuestos };
