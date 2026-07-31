const { query } = require('../lib/db');

const getAdminSubscribers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataResult = await query('SELECT id, email, name, active, created_at FROM subscribers ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await query('SELECT COUNT(*) AS total FROM subscribers');
    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: dataResult.rows,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (err) {
    console.error('Error obteniendo suscriptores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateSubscriber = async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  try {
    const result = await query('UPDATE subscribers SET active = $1 WHERE id = $2 RETURNING id, email, name, active', [active !== false, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Suscriptor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando suscriptor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteSubscriber = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM subscribers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Suscriptor no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando suscriptor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAdminSubscribers, updateSubscriber, deleteSubscriber };