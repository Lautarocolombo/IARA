const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { query } = require('../lib/db');
const logger = require('../lib/logger');

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

const login = async (req, res) => {
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

    let role = null;
    let user = null;
    let permissions = {};

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    const dbUser = await query('SELECT * FROM users WHERE username = $1 AND active = TRUE', [cleanUsername]);
    if (dbUser.rows.length > 0) {
      const u = dbUser.rows[0];
      const match = await bcrypt.compare(cleanPassword, u.password_hash);
      if (match) {
        role = u.role || 'admin';
        user = u.username;
        permissions = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
      }
    }

    if (!role && cleanUsername.toLowerCase() === (ADMIN_USER || '').toLowerCase()) {
      if (ADMIN_PASS_HASH) {
        let hashMatch = false;
        try {
          hashMatch = await bcrypt.compare(cleanPassword, ADMIN_PASS_HASH);
        } catch (err) {
          logger.warn({ username: cleanUsername, error: err.message }, 'ADMIN_PASS_HASH no es un hash bcrypt válido');
        }
        if (hashMatch) {
          role = 'admin';
          user = ADMIN_USER;
          permissions = { all: true };
        } else if (ADMIN_PASS) {
          if (cleanPassword === ADMIN_PASS) {
            role = 'admin';
            user = ADMIN_USER;
            permissions = { all: true };
          }
        }
      } else if (ADMIN_PASS) {
        if (cleanPassword === ADMIN_PASS) {
          role = 'admin';
          user = ADMIN_USER;
          permissions = { all: true };
        }
      }
    }

    if (!role) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }

    const token = jwt.sign({ role, user, permissions }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user, role, permissions });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const refresh = async (req, res) => {
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
    const accessToken = jwt.sign({ role: decoded.role, user: decoded.user, permissions: decoded.permissions || {} }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token: accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
};

const logout = (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ ok: true });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  let hashMatch = false;
  if (ADMIN_PASS_HASH) {
    try { hashMatch = await bcrypt.compare(currentPassword, ADMIN_PASS_HASH); } catch(e) {}
    if (!hashMatch && ADMIN_PASS) hashMatch = currentPassword === ADMIN_PASS;
  } else if (ADMIN_PASS) {
    hashMatch = currentPassword === ADMIN_PASS;
  }

  if (!hashMatch) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const newHash = await bcrypt.hash(newPassword, 10);
  res.json({ ok: true, message: 'Contraseña actualizada. Recordá actualizar ADMIN_PASS_HASH en las variables de entorno del servidor.', newHash });
};

module.exports = { login, refresh, logout, hashPassword, changePassword };

