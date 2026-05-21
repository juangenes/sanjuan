const Usuario = require('../models/usuario.model');

// Si la tabla `usuarios` está vacía, siembra admin/expendio desde el .env.
// Sólo se ejecuta una vez (mientras no haya usuarios). Una vez sembrados,
// las variables ADMIN_PASS / EXPENDIO_PASS dejan de leerse en runtime.
async function bootstrapUsuarios() {
  let n;
  try {
    n = await Usuario.contar();
  } catch (e) {
    if (e && e.code === 'ER_NO_SUCH_TABLE') {
      console.error(
        '[bootstrap] La tabla `usuarios` no existe. Corré las migraciones:\n' +
        '            cd backend && npm run migrate'
      );
      return;
    }
    throw e;
  }

  if (n > 0) return;

  const seeds = [
    { usuario: 'admin', password: process.env.ADMIN_PASS, rol: 'admin', nombre: 'Administrador' },
    { usuario: 'expendio', password: process.env.EXPENDIO_PASS, rol: 'expendio', nombre: 'Expendio' },
  ].filter(s => s.password);

  if (seeds.length === 0) {
    console.warn('[bootstrap] Tabla `usuarios` vacía y sin ADMIN_PASS/EXPENDIO_PASS en .env — no se sembró ningún usuario.');
    return;
  }

  for (const s of seeds) {
    await Usuario.crear(s);
    console.log(`[bootstrap] Usuario sembrado: ${s.usuario} (${s.rol})`);
  }
}

module.exports = { bootstrapUsuarios };
