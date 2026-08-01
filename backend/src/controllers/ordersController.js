const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getOrders = async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo pedidos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo tus pedidos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createOrder = async (req, res) => {
  const { items, total, customer, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost } = req.body || {};
  if (!items || !total) return res.status(400).json({ error: 'Items y total son requeridos' });
  try {
    const customerData = customer && typeof customer === 'object' ? customer : {};
    if (shipping_name) customerData.name = shipping_name;
    if (shipping_address) customerData.address = shipping_address;
    if (shipping_phone) customerData.phone = shipping_phone;
    if (shipping_email) customerData.email = shipping_email;
    if (shipping_zip) customerData.zip = shipping_zip;
    if (shipping_city) customerData.city = shipping_city;
    const result = await query(
      'INSERT INTO orders (items, total, customer, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [JSON.stringify(items), Number(total), JSON.stringify(customerData), 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creando pedido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateOrderStatus = async (req, res) => {
  const id = Number(req.params.id);
  const { status, mercadopago_id } = req.body || {};
  try {
    const result = await query(
      'UPDATE orders SET status = $1, mercadopago_id = $2 WHERE id = $3 RETURNING *',
      [status, mercadopago_id || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando pedido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOrders, createOrder, updateOrderStatus };
