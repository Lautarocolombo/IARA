const { query } = require('../lib/db');
const logger = require('../lib/logger');
const crypto = require('crypto');

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

    await query(
      'INSERT INTO webhook_events (event_id, source, payload, status) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO UPDATE SET payload = $3, status = $4',
      [eventId, 'transfer', JSON.stringify({ orderId, amount, reference }), 'processing']
    );

    await query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['confirmed', order.id]
    );

    await query(
      'UPDATE webhook_events SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE event_id = $2',
      ['processed', eventId]
    );

    logger.info({ orderId: order.id, amount, reference }, 'Pago por transferencia confirmado');
    res.status(200).json({ received: true, orderId: order.id, status: 'confirmed' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error confirmando pago por transferencia');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
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

module.exports = { confirmTransferPayment, getPaymentStatus };