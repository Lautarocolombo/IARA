function requireCustomHeader(req, res, next) {
  const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
  if (!customHeader) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

module.exports = { requireCustomHeader };
