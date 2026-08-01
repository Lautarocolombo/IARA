const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');

const login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Formato de solicitud inválido' });
    }
    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
    const EDITOR_USER = process.env.EDITOR_USER;
    const EDITOR_PASS_HASH = process.env.EDITOR_PASS_HASH;

    if (!ADMIN_USER || !ADMIN_PASS_HASH) {
      return res.status(500).json({ error: 'Credenciales de administrador no configuradas en el servidor' });
    }

    let role = null;
    let user = null;

    if (username.toLowerCase() === ADMIN_USER.toLowerCase()) {
      try {
        const match = await bcrypt.compare(password, ADMIN_PASS_HASH);
        if (match) {
          role = 'admin';
          user = ADMIN_USER;
        }
      } catch {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
    }

    if (!role && EDITOR_USER && username.toLowerCase() === EDITOR_USER.toLowerCase()) {
      try {
        const match = await bcrypt.compare(password, EDITOR_PASS_HASH);
        if (match) {
          role = 'editor';
          user = EDITOR_USER;
        }
      } catch {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
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
