const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    const dbUser = await query('SELECT * FROM users WHERE username = $1 AND active = TRUE', [cleanUsername]);
    if (dbUser.rows.length > 0) {
      const u = dbUser.rows[0];
      const match = await bcrypt.compare(cleanPassword, u.password_hash);
      if (match) {
        const role = u.role || 'admin';
        const permissions = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
        }
        const token = jwt.sign({ role, user: u.username, permissions }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ role, user: u.username, permissions }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        return res.json({ token, user: u.username, role, permissions });
      }
    }

    const envUser = process.env.ADMIN_USER;
    const envPassHash = process.env.ADMIN_PASS_HASH;
    if (envUser && envPassHash && cleanUsername === envUser) {
      const envMatch = await bcrypt.compare(cleanPassword, envPassHash);
      if (envMatch) {
        const role = 'admin';
        const permissions = { all: true };
        const jwtUser = cleanUsername;
        const dbCheck = await query('SELECT username, password_hash FROM users WHERE username = $1', [jwtUser]);
        if (!dbCheck.rows.length) {
          await query('INSERT INTO users (username, password_hash, role, permissions, active) VALUES ($1, $2, $3, $4, $5)', [jwtUser, envPassHash, role, JSON.stringify(permissions), true]);
        } else if (dbCheck.rows[0].password_hash !== envPassHash) {
          await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2', [envPassHash, jwtUser]);
        }
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
        }
        const token = jwt.sign({ role, user: jwtUser, permissions }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ role, user: jwtUser, permissions }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        return res.json({ token, user: jwtUser, role, permissions });
      }
    }

    return res.status(401).json({ error: 'Credenciales inválidas' });
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
    const accessToken = jwt.sign({ role: decoded.role, user: decoded.user, permissions: decoded.permissions || {} }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ token: accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
};

const logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ ok: true });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  const user = req.user;
  if (!user) return res.status(401).json({ error: 'No autorizado' });

  const dbUser = await query('SELECT * FROM users WHERE username = $1 AND active = TRUE', [user.user]);
  if (!dbUser.rows.length) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const u = dbUser.rows[0];
  const match = await bcrypt.compare(currentPassword, u.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, u.username]);
  process.env.ADMIN_PASS_HASH = newHash;
  res.json({ ok: true, message: 'Contraseña actualizada correctamente en la base de datos y en memoria. Para cambios persistentes entre reinicios, actualice la variable de entorno ADMIN_PASS_HASH en su plataforma de despliegue.' });
};

module.exports = { login, refresh, logout, hashPassword, changePassword };

