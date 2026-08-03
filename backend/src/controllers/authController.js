const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../lib/logger');

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

    if (!ADMIN_USER || (!ADMIN_PASS_HASH && !ADMIN_PASS)) {
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
          logger.info({ username: cleanUsername, hashMatch }, 'bcrypt.compare result');
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
      logger.debug({ username: cleanUsername, expectedUser: ADMIN_USER, usernameMatch: false }, 'Username no coincide');
    }

    if (!role) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }
    const token = jwt.sign({ role, user }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user, role });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };
