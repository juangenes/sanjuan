const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Usuarios hardcoded por .env — en v2 migrar a tabla usuarios
const USUARIOS = {
  admin: { pass: process.env.ADMIN_PASS, rol: 'admin' },
  expendio: { pass: process.env.EXPENDIO_PASS, rol: 'expendio' },
};

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  const user = USUARIOS[usuario];
  if (!user || password !== user.pass) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const token = jwt.sign({ usuario, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, rol: user.rol });
});

module.exports = router;
