const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');
const { orderSchema } = require('../lib/validators');

const getOrders = async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo pedidos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo tus pedidos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createOrder = async (req, res) => {
  const { items, total, customer, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost } = req.body || {};

  const validation = orderSchema.safeParse({ items, total, customer });
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.errors[0]?.message || 'Datos inválidos' });
  }

  if (!items || !total) {
    return res.status(400).json({ error: 'Items y total son requeridos' });
  }

  try {
    const customerData = customer && typeof customer === 'object' ? customer : {};
    if (shipping_name) customerData.name = shipping_name;
    if (shipping_address) customerData.address = shipping_address;
    if (shipping_phone) customerData.phone = shipping_phone;
    if (shipping_email) customerData.email = shipping_email;
    if (shipping_zip) customerData.zip = shipping_zip;
    if (shipping_city) customerData.city = shipping_city;

    const result = await transaction(async (client) => {
      for (const item of items) {
        const stockResult = await query('SELECT stock FROM products WHERE id = $1', [Number(item.id)], client);
        if (stockResult.rows.length === 0) {
          throw new Error(`Producto ${item.id} no encontrado`);
        }
        const currentStock = stockResult.rows[0].stock;
        if (currentStock < item.quantity) {
          throw new Error(`Stock insuficiente para el producto ${item.id}. Disponible: ${currentStock}, solicitado: ${item.quantity}`);
        }
        await query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [Number(item.quantity), Number(item.id)],
          client
        );
      }

      const orderResult = await query(
        'INSERT INTO orders (items, total, customer, status, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
        [
          JSON.stringify(items),
          Number(total),
          JSON.stringify(customerData),
          'pending',
          shipping_name || '',
          shipping_address || '',
          shipping_phone || '',
          shipping_zip || '',
          shipping_city || '',
          shipping_email || '',
          Number(subtotal) || 0,
          Number(shipping_cost) || 0
        ],
        client
      );

      return orderResult.rows[0];
    });

    logger.info({ orderId: result.id, total, itemsCount: items.length }, 'Orden creada');
    res.status(201).json(result);
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando pedido');
    res.status(400).json({ error: err.message || 'Error interno del servidor' });
  }
};

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const updateOrderStatus = async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Estados válidos: ${VALID_STATUSES.join(', ')}` });
  }
  try {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error actualizando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteOrder = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = orderResult.rows[0];
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    if (order.status === 'pending' || order.status === 'confirmed') {
      for (const item of items) {
        await query(
          'UPDATE products SET stock = stock + $1 WHERE id = $2',
          [Number(item.quantity), Number(item.id)]
        );
      }
    }
    await query('DELETE FROM orders WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOrders, getUserOrders, createOrder, updateOrderStatus, deleteOrder };
