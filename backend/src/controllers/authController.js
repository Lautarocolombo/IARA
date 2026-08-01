const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');

const DEV_MODE = process.env.NODE_ENV !== 'production';

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
    const ADMIN_PASS = process.env.ADMIN_PASS;

    if (!ADMIN_USER || !ADMIN_PASS) {
      return res.status(500).json({ error: 'Credenciales de administrador no configuradas en el servidor' });
    }

    let role = null;
    let user = null;

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // DIAGNÓSTICO TEMPORAL
    logger.info('DIAG LOGIN: received_user="%s" expected_user="%s" pass_len=%d env_pass_len=%d', cleanUsername, ADMIN_USER, cleanPassword.length, ADMIN_PASS.length);

    if (cleanUsername.toLowerCase() === ADMIN_USER.toLowerCase() && cleanPassword === ADMIN_PASS) {
      role = 'admin';
      user = ADMIN_USER;
    } else if (DEV_MODE) {
      logger.info('Login admin: credenciales incorrectas (recibido=%s, esperado=%s)', cleanUsername, ADMIN_USER);
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
