const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../lib/db');
const logger = require('../lib/logger');
const tokenBlacklist = require('../lib/tokenBlacklist');

const RESET_TOKENS = new Map();
const RESET_TOKEN_EXPIRY = 15 * 60 * 1000;

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
        await query('UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [u.id]);
        const role = u.role || 'admin';
        const permissions = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
        }
        const token = jwt.sign({ role, user: u.username, permissions, tenant_id: u.tenant_id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ role, user: u.username, permissions, tenant_id: u.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        return res.json({ token, user: u.username, role, permissions });
      } else {
        logger.warn({ username: cleanUsername, userId: u.id }, 'Login fallido: contraseña incorrecta para usuario en DB');
      }
    } else {
      logger.warn({ username: cleanUsername }, 'Login fallido: usuario no encontrado en DB');
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
          await query('INSERT INTO users (username, password_hash, role, permissions, active, tenant_id) VALUES ($1, $2, $3, $4, $5, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))', [jwtUser, envPassHash, role, JSON.stringify(permissions), true]);
        } else if (dbCheck.rows[0].password_hash !== envPassHash) {
          await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2', [envPassHash, jwtUser]);
        }
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
        }
        const token = jwt.sign({ role, user: jwtUser, permissions, tenant_id: dbCheck.rows[0]?.tenant_id || 'default' }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ role, user: jwtUser, permissions, tenant_id: dbCheck.rows[0]?.tenant_id || 'default' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        return res.json({ token, user: jwtUser, role, permissions });
      } else {
        logger.warn({ username: cleanUsername }, 'Login fallido: contraseña incorrecta para ADMIN_USER env');
      }
    } else if (cleanUsername === (envUser || '')) {
      logger.warn({ username: cleanUsername, hasEnvHash: !!envPassHash }, 'Login fallido: ADMIN_USER coincide pero falta ADMIN_PASS_HASH o contraseña incorrecta');
    } else {
      logger.warn({ username: cleanUsername, envUser: envUser || '(no definido)' }, 'Login fallido: usuario no coincide con ADMIN_USER env');
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
    const accessToken = jwt.sign({ role: decoded.role, user: decoded.user, permissions: decoded.permissions || {}, tenant_id: decoded.tenant_id }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ token: accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
};

const logout = (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    tokenBlacklist.add(token);
  }
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
  if (dbUser.rows.length === 0) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const u = dbUser.rows[0];
  const match = await bcrypt.compare(currentPassword, u.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, u.username]);

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    tokenBlacklist.add(token);
  }

  res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    const result = await query('SELECT id, username FROM users WHERE email = $1 AND active = TRUE', [email]);
    if (result.rows.length === 0) {
      return res.json({ ok: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
      [resetHash, user.id]
    );

    RESET_TOKENS.set(resetToken, { userId: user.id, username: user.username, expires: Date.now() + RESET_TOKEN_EXPIRY });
    setTimeout(() => RESET_TOKENS.delete(resetToken), RESET_TOKEN_EXPIRY);

    const resetLink = `${process.env.SITE_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;
    const html = `
      <h1>Recuperación de contraseña</h1>
      <p>Hola ${user.username},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el siguiente enlace:</p>
      <p><a href="${resetLink}">Restablecer contraseña</a></p>
      <p>Este enlace vence en 15 minutos.</p>
      <p>Si no solicitaste este cambio, ignorá este email.</p>
    `;
    await require('../lib/email').sendEmail({ to: email, subject: 'Recuperación de contraseña - Artesanía Gualeguay', html });

    res.json({ ok: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
  } catch (err) {
    logger.error('Error en requestPasswordReset:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const resetHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query('SELECT id, reset_token_expires FROM users WHERE reset_token = $1 AND active = TRUE', [resetHash]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const user = result.rows[0];
    if (new Date(user.reset_token_expires) < new Date()) {
      await query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [user.id]);
      return res.status(400).json({ error: 'Token expirado' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [newHash, user.id]);

    res.json({ ok: true, message: 'Contraseña restablecida correctamente.' });
  } catch (err) {
    logger.error('Error en resetPassword:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, refresh, logout, hashPassword, changePassword, requestPasswordReset, resetPassword };

