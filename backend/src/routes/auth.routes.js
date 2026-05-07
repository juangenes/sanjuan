const router = require('express').Router();
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  const user = await Usuario.buscarPorUsuario(usuario);
  if (!user || !user.activo) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const ok = await Usuario.verificarPassword(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  await Usuario.registrarLogin(user.id);

  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, rol: user.rol, usuario: user.usuario });
});

module.exports = router;
