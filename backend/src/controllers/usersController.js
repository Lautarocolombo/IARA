const { query } = require('../lib/db');
const logger = require('../lib/logger');
const bcrypt = require('bcryptjs');

const getUsers = async (req, res) => {
  try {
    const result = await query('SELECT id, username, role, permissions, active, created_at, updated_at FROM users ORDER BY created_at DESC');
    const users = result.rows.map(u => ({
      ...u,
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {})
    }));
    res.json(users);
  } catch (err) {
    logger.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, role, permissions, active } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    const hash = await bcrypt.hash(password, 10);
    const perms = typeof permissions === 'string' ? permissions : JSON.stringify(permissions || {});
    const result = await query(
      'INSERT INTO users (username, password_hash, role, permissions, active, tenant_id) VALUES ($1, $2, $3, $4, $5, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING id, username, role, permissions, active, created_at',
      [username, hash, role || 'viewer', perms, active !== false]
    );
    const user = result.rows[0];
    user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {});
    res.status(201).json(user);
  } catch (err) {
    logger.error('Error creando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, password, role, permissions, active } = req.body || {};
    const updates = {};
    const fields = [];
    const values = [];

    if (username) { fields.push(`username = $${fields.length + 1}`); values.push(username); }
    if (role) { fields.push(`role = $${fields.length + 1}`); values.push(role); }
    if (active !== undefined) { fields.push(`active = $${fields.length + 1}`); values.push(active); }
    if (permissions !== undefined) { fields.push(`permissions = $${fields.length + 1}`); values.push(typeof permissions === 'string' ? permissions : JSON.stringify(permissions)); }
    if (password) { fields.push(`password_hash = $${fields.length + 1}`); values.push(await bcrypt.hash(password, 10)); }

    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });

    values.push(id);
    const setClause = fields.join(', ');

    const result = await query(`UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING id, username, role, permissions, active, created_at`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = result.rows[0];
    user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {});
    res.json(user);
  } catch (err) {
    logger.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
