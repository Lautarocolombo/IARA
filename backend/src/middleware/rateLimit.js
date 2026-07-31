const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.CSRF_SECRET) {
  console.warn('[CSRF] CSRF_SECRET no configurado. Los tokens se invalidan al reiniciar el servidor. Definí CSRF_SECRET en .env para producción.');
}
const consumedCSRFtokens = new Set();

setInterval(() => { consumedCSRFtokens.clear(); }, 15 * 60 * 1000);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de inicio de sesión. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

function generateCSRFToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex');
  return `${token}.${signature}`;
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  const exemptPaths = ['/api/auth/login', '/api/csrf-token'];
  if (exemptPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body?._csrf;

  if (!token) {
    return res.status(403).json({ error: 'CSRF token requerido' });
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return res.status(403).json({ error: 'CSRF token inválido o expirado' });
  }

  const [tokenValue, signature] = parts;
  const expected = crypto.createHmac('sha256', CSRF_SECRET).update(tokenValue).digest('hex');

  if (consumedCSRFtokens.has(tokenValue)) {
    return res.status(403).json({ error: 'CSRF token ya utilizado' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(403).json({ error: 'CSRF token inválido o expirado' });
  }

  consumedCSRFtokens.add(tokenValue);

  next();
}

function getCSRFToken(req, res, next) {
  const token = generateCSRFToken();
  res.locals.csrfToken = token;
  next();
}

module.exports = { loginLimiter, globalLimiter, csrfProtection, getCSRFToken, generateCSRFToken };
