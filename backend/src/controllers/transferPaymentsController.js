const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { expireTransferReservations } = require('../controllers/ordersController');

async function listTransferPayments(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(Number(limit), 100));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND pr.status = $${params.length}`;
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM payment_receipts pr ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT pr.*, o.id as order_id, o.total as order_total, o.status as order_status, o.payment_method, o.customer, o.shipping_name, o.shipping_email, o.shipping_phone, o.items, o.created_at as order_created_at
       FROM payment_receipts pr
       JOIN orders o ON pr.order_id = o.id
       ${where}
       ORDER BY pr.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const receipts = result.rows.map(r => {
      const customer = typeof r.customer === 'string' ? JSON.parse(r.customer) : (r.customer || {});
      const items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []);
      return {
        ...r,
        customer_name: customer.name || r.shipping_name || '',
        customer_email: customer.email || r.shipping_email || '',
        items_count: items.length
      };
    });

    res.json({
      receipts,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error listando pagos por transferencia');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function verifyTransferPayment(req, res) {
  const receiptId = Number(req.params.receiptId);
  const adminUser = req.user?.user || 'admin';

  try {
    const receiptResult = await query('SELECT * FROM payment_receipts WHERE id = $1', [receiptId]);
    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }
    const receipt = receiptResult.rows[0];

    if (receipt.status === 'verified') {
      return res.status(400).json({ error: 'Este comprobante ya fue verificado' });
    }

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [receipt.order_id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const order = orderResult.rows[0];

    if (order.payment_method !== 'transfer') {
      return res.status(400).json({ error: 'Este pedido no es de transferencia' });
    }

    if (order.status === 'cancelled' || order.status === 'rejected' || order.status === 'expired') {
      return res.status(400).json({ error: `No se puede verificar un pedido en estado "${order.status}"` });
    }

    if (order.status === 'confirmed') {
      return res.status(400).json({ error: 'El pedido ya está confirmado' });
    }

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    for (const item of items) {
      const stockResult = await query('SELECT stock FROM products WHERE id = $1', [Number(item.id)]);
      const currentStock = stockResult.rows[0]?.stock || 0;
      if (currentStock < item.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para confirmar. Producto ${item.name || item.id}: disponible ${currentStock}, requerido ${item.quantity}` });
      }
    }

    await query('UPDATE orders SET status = $1, payment_status = $2, transfer_amount_paid = $3 WHERE id = $4',
      ['confirmed', 'verified', receipt.amount_paid, order.id]);

    await query(
      'UPDATE payment_receipts SET status = $1, verified_at = CURRENT_TIMESTAMP, verified_by = $2 WHERE id = $3',
      ['verified', adminUser, receiptId]
    );

    for (const item of items) {
      await query('UPDATE products SET stock = stock - $1 WHERE id = $2', [Number(item.quantity), Number(item.id)]);
    }

    logger.info({ receiptId, orderId: order.id, adminUser }, 'Pago por transferencia verificado');
    res.json({ ok: true, message: 'Pago verificado y stock descontado' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error verificando pago por transferencia');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function rejectTransferPayment(req, res) {
  const receiptId = Number(req.params.receiptId);
  const { reason } = req.body || {};
  const adminUser = req.user?.user || 'admin';

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'El motivo de rechazo es requerido' });
  }

  try {
    const receiptResult = await query('SELECT * FROM payment_receipts WHERE id = $1', [receiptId]);
    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }
    const receipt = receiptResult.rows[0];

    if (receipt.status === 'verified') {
      return res.status(400).json({ error: 'Este comprobante ya fue verificado' });
    }

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [receipt.order_id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const order = orderResult.rows[0];

    if (order.payment_method !== 'transfer') {
      return res.status(400).json({ error: 'Este pedido no es de transferencia' });
    }

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    await query("UPDATE orders SET status = 'rejected', payment_status = 'rejected', transfer_rejection_reason = $1 WHERE id = $2",
      [reason.trim(), order.id]);

    await query(
      'UPDATE payment_receipts SET status = $1, verified_at = CURRENT_TIMESTAMP, verified_by = $2 WHERE id = $3',
      ['rejected', adminUser, receiptId]
    );

    if (order.status === 'confirmed') {
      for (const item of items) {
        await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [Number(item.quantity), Number(item.id)]);
      }
    }

    logger.info({ receiptId, orderId: order.id, reason, adminUser }, 'Pago por transferencia rechazado');
    res.json({ ok: true, message: 'Pago rechazado' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error rechazando pago por transferencia');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getExpiredOrders(req, res) {
  try {
    const result = await query(
      `SELECT * FROM orders WHERE status = 'expired' AND payment_method = 'transfer' ORDER BY created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo pedidos expirados');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function refundStockForOrder(req, res) {
  const id = Number(req.params.id);
  try {
    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = orderResult.rows[0];
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    for (const item of items) {
      await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [Number(item.quantity), Number(item.id)]);
    }

    await query("UPDATE orders SET status = 'cancelled', payment_status = 'cancelled' WHERE id = $1", [id]);

    const user = req.user?.user || 'admin';
    await query('INSERT INTO activity_log (username, action, entity_type, entity_id, details, ip) VALUES ($1, $2, $3, $4, $5, $6)',
      [user, 'refund_stock', 'order', id, 'Stock devuelto manualmente', req.ip || '']);

    res.json({ ok: true, message: 'Stock devuelto y pedido cancelado' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error devolviendo stock');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listTransferPayments, verifyTransferPayment, rejectTransferPayment, getExpiredOrders, refundStockForOrder };
