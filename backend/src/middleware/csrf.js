const crypto = require('crypto');

function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const fullPath = (req.originalUrl || req.url || '').split('?')[0];
  if (fullPath === '/api/admin/upload') {
    return next();
  }
  if (fullPath === '/api/sync') {
    return next();
  }
  if (fullPath === '/api/coupons/validate') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);

  if (allowedOrigins.length === 0) {
    return next();
  }

  const isAllowed = allowedOrigins.some(allowed => {
    if (!allowed) return false;
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      try {
        return new RegExp('^' + pattern + '$').test(origin);
      } catch {
        return false;
      }
    }
    return false;
  });

  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Origin no permitido' });
  }

  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!sessionToken && !process.env.CSRF_SECRET) {
      return next();
    }

    const expected = sessionToken || process.env.CSRF_SECRET;
    if (!csrfToken || csrfToken !== expected) {
      return res.status(403).json({ error: 'CSRF token inválido' });
    }
  }

  next();
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { csrfProtection, generateCsrfToken };
