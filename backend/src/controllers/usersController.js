const { query } = require('../lib/db');
const bcrypt = require('bcrypt');
const logger = require('../lib/logger');

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

const getUsers = async (req, res) => {
  try {
    const result = await query('SELECT id, username, role, permissions, active, created_at, updated_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getUser = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('SELECT id, username, role, permissions, active, created_at, updated_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error obteniendo usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createUser = async (req, res) => {
  const { username, password, role = 'admin', permissions = {}, active = true } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  try {
    const password_hash = await hashPassword(password);
    const result = await query(
      'INSERT INTO users (username, password_hash, role, permissions, active) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, permissions, active, created_at, updated_at',
      [username, password_hash, role, JSON.stringify(permissions), active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateUser = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'password_hash');
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    let val = updates[f];
    if (f === 'permissions') val = JSON.stringify(val);
    setParts.push(`${f} = $${i + 1}`);
    values.push(val);
  });
  values.push(id);
  
  try {
    const result = await query(`UPDATE users SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING id, username, role, permissions, active, created_at, updated_at`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteUser = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser, hashPassword };
