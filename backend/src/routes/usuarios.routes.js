const router = require('express').Router();
const Usuario = require('../models/usuario.model');
const { authAdmin, authExpendio } = require('../middleware/auth');

const ROLES_VALIDOS = ['admin', 'expendio', 'tarjetas'];

function validarUsuario(usuario) {
  return typeof usuario === 'string' && /^[a-zA-Z0-9._-]{3,50}$/.test(usuario);
}

function validarPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 100;
}

async function quedariaSinAdminActivo(idEditando, { rol, activo }) {
  if (rol === 'admin' && activo) return false;
  const usuarios = await Usuario.listar();
  const otrosAdminsActivos = usuarios.filter(
    u => u.rol === 'admin' && u.activo && u.id !== idEditando
  );
  return otrosAdminsActivos.length === 0;
}

// Perfil del usuario logueado (admin o expendio)
router.get('/me', authExpendio, async (req, res) => {
  const u = await Usuario.buscarPorId(req.user.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ usuario: u });
});

// Cambiar la propia contraseña
router.put('/me/password', authExpendio, async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!validarPassword(nueva)) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  const u = await Usuario.buscarPorUsuario(req.user.usuario);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await Usuario.verificarPassword(actual || '', u.password_hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  await Usuario.cambiarPassword(u.id, nueva);
  res.json({ ok: true });
});

// --- Endpoints de administración ---

router.get('/', authAdmin, async (_req, res) => {
  const usuarios = await Usuario.listar();
  res.json({ usuarios });
});

router.post('/', authAdmin, async (req, res) => {
  const { usuario, password, rol, nombre, activo = true } = req.body || {};
  if (!validarUsuario(usuario)) {
    return res.status(400).json({ error: 'Usuario inválido (3-50 chars: letras, números, . _ -)' });
  }
  if (!validarPassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const existente = await Usuario.buscarPorUsuario(usuario);
  if (existente) return res.status(409).json({ error: 'El usuario ya existe' });

  const id = await Usuario.crear({ usuario, password, rol, nombre, activo });
  res.status(201).json({ id });
});

router.put('/:id', authAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { usuario, rol, nombre, activo = true } = req.body || {};
  if (!validarUsuario(usuario)) {
    return res.status(400).json({ error: 'Usuario inválido' });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const actual = await Usuario.buscarPorId(id);
  if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });

  // No permitir quedarse sin ningún admin activo
  if (await quedariaSinAdminActivo(id, { rol, activo })) {
    return res.status(400).json({ error: 'Debe quedar al menos un admin activo' });
  }

  // Si cambia el nombre de usuario, validar que no choque
  if (usuario !== actual.usuario) {
    const choque = await Usuario.buscarPorUsuario(usuario);
    if (choque) return res.status(409).json({ error: 'El usuario ya existe' });
  }

  await Usuario.actualizar(id, { usuario, rol, nombre, activo });
  res.json({ ok: true });
});

router.put('/:id/password', authAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  if (!validarPassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const u = await Usuario.buscarPorId(id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  await Usuario.cambiarPassword(id, password);
  res.json({ ok: true });
});

router.delete('/:id', authAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
  }
  const u = await Usuario.buscarPorId(id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (await quedariaSinAdminActivo(id, { rol: null, activo: false })) {
    return res.status(400).json({ error: 'Debe quedar al menos un admin activo' });
  }

  await Usuario.eliminar(id);
  res.json({ ok: true });
});

module.exports = router;
