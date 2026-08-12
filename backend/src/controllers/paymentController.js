const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');
const crypto = require('crypto');
const { enqueueWebhook } = require('../queues/webhookQueue');

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
      'UPDATE orders SET status = $1 WHERE id = $2 AND status != $1 RETURNING id',
      ['confirmed', Number(orderId)],
      client
    );

    if (updateResult.rowCount > 0) {
      await query(
        'UPDATE webhook_events SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE event_id = $2',
        ['processed', reference],
        client
      );
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

module.exports = { confirmTransferPayment, getPaymentStatus, processWebhookSync };
