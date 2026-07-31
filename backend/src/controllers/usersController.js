const { query } = require('../lib/db');
const bcrypt = require('bcryptjs');

const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataResult = await query('SELECT id, username, role, active, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await query('SELECT COUNT(*) AS total FROM users');
    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: dataResult.rows,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (err) {
    console.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateUserRole = async (req, res) => {
  const id = Number(req.params.id);
  const { role, active } = req.body || {};
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (role !== undefined) {
      if (!['admin', 'editor'].includes(role)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }
      fields.push(`role = $${idx}`);
      values.push(role);
      idx++;
    }
    if (active !== undefined) {
      fields.push(`active = $${idx}`);
      values.push(active);
      idx++;
    }
    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    values.push(id);
    const result = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, username, role, active`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getUsers, updateUserRole };