const { query } = require('../lib/db');
const { orderSchema, publicOrderSchema } = require('../lib/validators');
const { sendOrderShippedEmail } = require('../lib/email');

// Regla de envío plana — debe coincidir con public/js/config.js (CONFIG.CART).
// Si en algún momento pasa a ser por zona/CP, este es el único lugar a tocar.
const FLAT_SHIPPING_COST = 200;
const FREE_SHIPPING_THRESHOLD = 2000;

const VALID_ORDER_STATUSES = ['pending', 'pending_payment', 'approved', 'in_process', 'shipped', 'delivered', 'cancelled', 'rejected', 'failed', 'chargeback'];

const FINAL_STATUSES = ['cancelled', 'rejected', 'failed', 'chargeback', 'delivered'];

const ALLOWED_TRANSITIONS = {
  pending: ['approved', 'pending_payment', 'cancelled', 'rejected'],
  pending_payment: ['approved', 'in_process', 'cancelled', 'rejected', 'failed', 'chargeback'],
  approved: ['in_process', 'shipped', 'cancelled', 'chargeback'],
  in_process: ['shipped', 'cancelled', 'chargeback'],
  shipped: ['delivered', 'cancelled', 'chargeback'],
  delivered: [],
  cancelled: [],
  rejected: [],
  failed: [],
  chargeback: []
};

function isValidTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  if (FINAL_STATUSES.includes(currentStatus)) return false;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

const adjustStock = async (productId, qty, type, orderId = null, notes = '') => {
  const productResult = await query('SELECT stock FROM products WHERE id = $1', [productId]);
  if (productResult.rows.length === 0) throw new Error(`Producto ${productId} no encontrado`);

  const updatedResult = await query(
    'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stock >= $1 RETURNING stock',
    [qty, productId]
  );
  if (updatedResult.rows.length === 0) {
    const current = Number(productResult.rows[0].stock || 0);
    throw new Error(`Stock insuficiente para producto ${productId}. Disponible: ${current}`);
  }
  const newStock = Number(updatedResult.rows[0].stock);
  await query(
    'INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, order_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [productId, type, qty, newStock + qty, newStock, orderId || null, notes]
  );
  return newStock;
};

const refundStock = async (orderId, notes = '') => {
  const orderResult = await query('SELECT items FROM orders WHERE id = $1', [orderId]);
  if (orderResult.rows.length === 0) return;
  const items = JSON.parse(orderResult.rows[0].items || '[]');
  for (const item of items) {
    const productId = Number(item.id);
    const qty = Number(item.qty) || 1;
    if (!productId) continue;
    await adjustStock(productId, qty, 'return', orderId, notes || 'Devolución por pago rechazado/cancelado');
  }
};

const getOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataResult = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await query('SELECT COUNT(*) AS total FROM orders');
    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: dataResult.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    console.error('Error obteniendo pedidos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createOrder = async (req, res) => {
  try {
    const data = orderSchema.parse(req.body);
    const result = await query(
      'INSERT INTO orders (items, total, status) VALUES ($1, $2, $3) RETURNING *',
      [JSON.stringify(data.items), Number(data.total), 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    console.error('Error creando pedido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createPublicOrder = async (req, res) => {
  try {
    const data = publicOrderSchema.parse(req.body);
    const { items, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email } = data;
    // shipping_cost y discount NO se toman del body: se recalculan acá.
    // El cliente puede mandar cualquier valor, pero se ignora — evita que
    // alguien manipule el request para inflar un descuento o pisar el envío.

    const stockValidations = await Promise.all(items.map(async (item) => {
      const productId = Number(item.id);
      const qty = Number(item.qty) || 1;
      if (!productId) return { ok: true };
      const productResult = await query('SELECT id, name, price, stock FROM products WHERE id = $1', [productId]);
      if (productResult.rows.length === 0) return { ok: false, error: `Producto ${productId} no encontrado` };
      if (Number(productResult.rows[0].stock) < qty) return { ok: false, error: `Stock insuficiente para ${item.name || productResult.rows[0].name}. Disponible: ${productResult.rows[0].stock}` };
      return { ok: true, product: productResult.rows[0] };
    }));

    const failed = stockValidations.find(v => !v.ok);
    if (failed) return res.status(409).json({ error: failed.error });

    const preferenceItems = [];
    let subtotal = 0;

    for (const validation of stockValidations) {
      if (!validation.product) continue;
      const item = items.find(i => Number(i.id) === validation.product.id);
      const qty = Number(item.qty) || 1;
      const unitPrice = Number(validation.product.price);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      preferenceItems.push({
        id: validation.product.id,
        name: validation.product.name,
        unit_price: unitPrice,
        quantity: qty,
        total: lineTotal
      });
    }

    const shipping_cost = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
    const discount = 0; // sin sistema de cupones todavía — placeholder fijo en 0
    const total = subtotal + shipping_cost - discount;

    const customer = {
      name: shipping_name,
      address: shipping_address,
      phone: shipping_phone,
      zip: shipping_zip,
      city: shipping_city,
      email: shipping_email || ''
    };

    const result = await query(
      'INSERT INTO orders (items, total, customer, customer_name, customer_email, customer_phone, customer_address, subtotal, shipping_cost, discount, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [
        JSON.stringify(preferenceItems),
        Number(total),
        JSON.stringify(customer),
        shipping_name || '',
        shipping_email || '',
        shipping_phone || '',
        JSON.stringify({ address: shipping_address, zip: shipping_zip, city: shipping_city }),
        Number(subtotal),
        Number(shipping_cost || 0),
        Number(discount || 0),
        'pending_payment'
      ]
    );
    const order = result.rows[0];

    res.status(201).json(order);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    console.error('Error creando pedido público:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicOrder = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('SELECT id, items, total, customer_name, customer_email, customer_phone, customer_address, subtotal, shipping_cost, status, mercadopago_id, created_at, updated_at FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo pedido público:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateOrderStatus = async (req, res) => {
  const id = Number(req.params.id);
  const { status, mercadopago_id } = req.body || {};
  try {
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Estados válidos: ${VALID_ORDER_STATUSES.join(', ')}` });
    }

    const currentResult = await query('SELECT id, status, items FROM orders WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const current = currentResult.rows[0];

    if (!isValidTransition(current.status, status)) {
      return res.status(409).json({
        error: `No se puede cambiar de '${current.status}' a '${status}'. Transición no permitida.`,
        current_status: current.status,
        allowed_transitions: ALLOWED_TRANSITIONS[current.status] || []
      });
    }

    const result = await query(
      'UPDATE orders SET status = $1, mercadopago_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, mercadopago_id || current.mercadopago_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    await query('INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)', [id, status, `Estado actualizado manualmente a ${status}`]);
    if (status === 'shipped' && current.status !== 'shipped') {
      sendOrderShippedEmail(result.rows[0]).catch((e) => console.error('Error mail despacho:', e.message));
    }
    if ((status === 'cancelled' || status === 'rejected' || status === 'failed') && current.status !== status) {
      try {
        const items = JSON.parse(current.items || '[]');
        for (const item of items) {
          const productId = Number(item.id);
          const qty = Number(item.qty || 1);
          if (!productId) continue;
          await adjustStock(productId, qty, 'return', id, `Devolución manual ${status}`);
        }
      } catch (refundErr) {
        console.error('Error devolviendo stock en updateOrderStatus:', refundErr);
      }
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando pedido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOrders, createOrder, updateOrderStatus, createPublicOrder, getPublicOrder, adjustStock, refundStock, isValidTransition, VALID_ORDER_STATUSES, ALLOWED_TRANSITIONS };
