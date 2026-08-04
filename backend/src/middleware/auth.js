const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const logger = require('../lib/logger');

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['admin', 'editor'].includes(decoded.role)) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    // El rol admin siempre tiene acceso completo, sin depender de la matriz de permisos
    if (req.user.role === 'admin') {
      return next();
    }
    const perms = req.user.permissions || {};
    if (perms.all === true || perms[permission] === true) {
      return next();
    }
    return res.status(403).json({ error: `Permiso requerido: ${permission}` });
  };
}

async function login(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Formato de solicitud inválido' });
    }

    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
    const ADMIN_PASS = process.env.ADMIN_PASS;

    if (!ADMIN_USER || (!ADMIN_PASS_HASH && !ADMIN_PASS)) {
      logger.warn('Credenciales de admin no configuradas');
      return res.status(500).json({ error: 'Credenciales de administrador no configuradas en el servidor' });
    }

    let role = null;
    let user = null;

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    logger.info({ username: cleanUsername, hasHash: !!ADMIN_PASS_HASH, hasPlainPass: !!ADMIN_PASS }, 'Intento de login');

    if (cleanUsername.toLowerCase() === ADMIN_USER.toLowerCase()) {
      if (ADMIN_PASS_HASH) {
        let hashMatch = false;
        try {
          hashMatch = await bcrypt.compare(cleanPassword, ADMIN_PASS_HASH);
          logger.info({ username: cleanUsername, hashMatch, hashPrefix: ADMIN_PASS_HASH.slice(0, 7) }, 'bcrypt.compare result');
        } catch (err) {
          logger.warn({ username: cleanUsername, error: err.message }, 'ADMIN_PASS_HASH no es un hash bcrypt válido');
        }
        if (hashMatch) {
          role = 'admin';
          user = ADMIN_USER;
        } else if (ADMIN_PASS) {
          logger.info({ username: cleanUsername, reason: 'hash_no_match' }, 'bcrypt.compare devolvió false, intentando ADMIN_PASS fallback');
          if (cleanPassword === ADMIN_PASS) {
            role = 'admin';
            user = ADMIN_USER;
          }
        }
      } else if (ADMIN_PASS) {
        if (cleanPassword === ADMIN_PASS) {
          role = 'admin';
          user = ADMIN_USER;
        }
      }
    } else {
      logger.info({ username: cleanUsername, expectedUser: ADMIN_USER, usernameMatch: false }, 'Username no coincide');
    }

    if (!role) {
      logger.warn({ username: cleanUsername }, 'Intento de login fallido');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }

    const accessToken = jwt.sign({ role, user }, JWT_SECRET, { expiresIn: '8h' });
    const refreshToken = generateRefreshToken();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh'
    });

    logger.info({ user }, 'Login exitoso');
    res.json({ token: accessToken, user, role });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Login error');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function refresh(req, res, next) {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token no proporcionado' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const accessToken = jwt.sign({ role: decoded.role, user: decoded.user }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token: accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
}

function logout(req, res, next) {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ ok: true });
}

module.exports = { adminAuth, adminOnly, requirePermission, login, refresh, logout };
