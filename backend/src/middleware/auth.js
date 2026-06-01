const jwt = require('jsonwebtoken');

function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permiso' });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function authExpendio(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // Equipos unificados: una "caja" puede cobrar y también disparar retiros.
    if (!['admin', 'expendio', 'caja'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function authTarjetas(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (!['admin', 'tarjetas'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function authCaja(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (!['admin', 'caja'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authAdmin, authExpendio, authTarjetas, authCaja };
