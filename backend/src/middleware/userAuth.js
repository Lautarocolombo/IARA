const jwt = require('jsonwebtoken');

function userAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-user-token'];

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.username) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { userAuth };
