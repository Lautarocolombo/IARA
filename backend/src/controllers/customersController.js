const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getCustomers = async (req, res) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo clientes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getCustomer = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM customers WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    const customer = result.rows[0];
    const ordersResult = await query('SELECT * FROM orders WHERE customer->>\'email\' = $1 ORDER BY created_at DESC', [customer.email]);
    res.json({ ...customer, orders: ordersResult.rows });
  } catch (err) {
    logger.error('Error obteniendo detalle del cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCustomer = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    setParts.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  values.push(id);
  try {
    const result = await query(`UPDATE customers SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteCustomer = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getCustomers, getCustomer, updateCustomer, deleteCustomer };
