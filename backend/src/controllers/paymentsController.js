const { query } = require('../lib/db');

const getAdminPayments = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataResult = await query('SELECT * FROM payments ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await query('SELECT COUNT(*) AS total FROM payments');
    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: dataResult.rows,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (err) {
    console.error('Error obteniendo pagos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updatePaymentStatus = async (req, res) => {
  const id = Number(req.params.id);
  const { status, status_detail } = req.body || {};
  try {
    const result = await query(
      'UPDATE payments SET status = $1, status_detail = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status || '', status_detail || '', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando pago:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAdminPayments, updatePaymentStatus };