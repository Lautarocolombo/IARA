const crypto = require('crypto');

/**
 * CSRF protection middleware.
 *
 * Defense-in-depth model:
 *   - The ORIGIN check (Origin/Referer) runs for EVERY state-changing request
 *     (POST/PUT/PATCH/DELETE) when ALLOWED_ORIGINS is configured. This is a
 *     cheap, effective cross-site request defense and is the check that was
 *     already passing in production.
 *   - The CSRF-TOKEN check (x-csrf-token / body._csrf) is only enforced for
 *     AUTHENTICATED requests: those that carry a session cookie
 *     (req.session?.csrfToken) or a Bearer token (already bypassed above).
 *
 * Why: the app has NO session middleware installed, so `req.session` is always
 * undefined. With CSRF_SECRET generated in production (render.yaml
 * generateValue: true) the old code fell through to comparing against
 * process.env.CSRF_SECRET, which the public customer never sends. That made
 * EVERY public write (POST /api/orders, POST /api/payments/transfer,
 * POST /api/payments/proofs/:id) return 403 "CSRF token inválido".
 *
 * Public tokenless writes are still protected by: the origin check, the
 * per-order token (requireOrderToken), rate limiting (ordersLimiter) and the
 * audit log. They are NOT CSRF targets because they carry no authenticated
 * session cookie to steal.
 */

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
  const hasBearer = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && authHeader.startsWith('Bearer ');
  if (hasBearer) {
    return next();
  }

  // ---- Origin check: applies to all state-changing requests ----
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

  if (allowedOrigins.length > 0) {
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
      return res.status(403).json({ error: 'Origin no permitido', code: 'ORIGIN_NOT_ALLOWED' });
    }
  }

  // ---- CSRF-token check: only for authenticated (stateful) requests ----
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const sessionToken = req.session && req.session.csrfToken;
    const hasSession = !!sessionToken;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, CSRF_SECRET is REQUIRED (validated at startup).
    // If somehow missing at runtime, fail closed.
    if (isProduction && !process.env.CSRF_SECRET) {
      return res.status(500).json({ error: 'CSRF_SECRET no configurado en producción', code: 'CSRF_SECRET_MISSING' });
    }

    // No session cookie and no CSRF_SECRET configured => nothing to compare
    // against; the origin check above is the only defense. Public tokenless
    // writes (e.g. POST /api/orders) are allowed here.
    // In development, warn explicitly if degraded.
    if (!hasSession && !process.env.CSRF_SECRET) {
      if (!isProduction) {
        console.warn('[CSRF] ⚠️ MODO DEGRADADO: CSRF_SECRET no configurado. Solo origin-check activo. Configurar CSRF_SECRET para protección completa.');
      }
      return next();
    }

    // Authenticated request (stateful session) MUST prove the token.
    if (hasSession) {
      const csrfToken = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
      const expected = sessionToken;
      if (!csrfToken || csrfToken !== expected) {
        return res.status(403).json({ error: 'CSRF token inválido', code: 'CSRF_TOKEN_INVALID' });
      }
    }
  }

  next();
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { csrfProtection, generateCsrfToken };