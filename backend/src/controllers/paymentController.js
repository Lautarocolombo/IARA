const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');
const crypto = require('crypto');
const { enqueueWebhook } = require('../queues/webhookQueue');
const { sendOrderStatusEmail } = require('../lib/email');

async function confirmTransferPayment(req, res) {
  try {
    const { orderId, amount, reference } = req.body || {};

    if (!orderId || !amount) {
      return res.status(400).json({ error: 'orderId y amount son requeridos' });
    }

    const orderResult = await query(
      'SELECT id, status, total FROM orders WHERE id = $1',
      [Number(orderId)]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const order = orderResult.rows[0];

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'No se puede confirmar pago de un pedido cancelado' });
    }

    if (Math.abs(order.total - Number(amount)) > 0.01) {
      return res.status(400).json({ error: 'El monto no coincide con el total del pedido' });
    }

    const eventId = reference || crypto.randomUUID();

    const webhookPayload = { orderId, amount, reference: eventId, source: 'transfer' };

    try {
      await enqueueWebhook(webhookPayload);
    } catch (queueErr) {
      logger.error({ err: queueErr.message }, 'Error encolando webhook, fallback a procesamiento síncrono');
      await processWebhookSync(webhookPayload);
    }

    res.status(202).json({ accepted: true, orderId: order.id, status: 'queued' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error confirmando pago por transferencia');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function processWebhookSync(payload) {
  const { orderId, amount, reference } = payload;
  await transaction(async (client) => {
    await query(
      'INSERT INTO webhook_events (event_id, source, payload, status, tenant_id) VALUES ($1, $2, $3, $4, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) ON CONFLICT (event_id) DO NOTHING RETURNING status',
      [reference, 'transfer', JSON.stringify({ orderId, amount, reference }), 'processing'],
      client
    );

    const updateResult = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND status != $1 RETURNING id, shipping_email, customer',
      ['confirmed', Number(orderId)],
      client
    );

    if (updateResult.rowCount > 0) {
      await query(
        'UPDATE webhook_events SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE event_id = $2',
        ['processed', reference],
        client
      );

      const updatedOrder = updateResult.rows[0];
      const customerEmail = updatedOrder.shipping_email || (typeof updatedOrder.customer === 'string' ? '' : updatedOrder.customer?.email) || '';
      if (customerEmail) {
        sendOrderStatusEmail({ id: Number(orderId), total: amount }, customerEmail, 'confirmed').catch(err => {
          logger.warn({ err: err.message, orderId }, 'No se pudo enviar email de estado por transferencia');
        });
      }
    } else {
      await query(
        'UPDATE webhook_events SET status = $1 WHERE event_id = $2',
        ['already_confirmed', reference],
        client
      );
    }
  });
}

async function getPaymentStatus(req, res) {
  try {
    const result = await query(
      'SELECT event_id, source, status, processed_at, created_at FROM webhook_events ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo estado de pagos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getPaymentReconciliation(req, res) {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE TRUE';
    const params = [];

    if (start_date) { params.push(start_date); where += ` AND date(o.created_at) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(o.created_at) <= $${params.length}`; }

    const summary = await query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(o.total) as total_amount,
        COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
        SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END) as confirmed_amount,
        COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
        SUM(CASE WHEN o.status = 'pending' THEN o.total ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
        SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END) as cancelled_amount
      FROM orders o
      ${where}
    `, params);

    const details = await query(`
      SELECT
        o.id,
        o.status,
        o.total,
        o.created_at,
        o.shipping_email,
        we.event_id,
        we.status as payment_status,
        we.processed_at
      FROM orders o
      LEFT JOIN webhook_events we ON we.payload->>'orderId' = o.id::text AND we.source = 'transfer'
      ${where}
      ORDER BY o.created_at DESC
      LIMIT 100
    `, params);

    res.json({
      summary: summary.rows[0],
      details: details.rows
    });
  } catch (err) {
    logger.error('Error obteniendo reconciliación de pagos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { confirmTransferPayment, getPaymentStatus, processWebhookSync, getPaymentReconciliation };
