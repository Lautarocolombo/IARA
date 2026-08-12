const { query } = require('../lib/db');
const logger = require('../lib/logger');

async function requireOrderToken(req, res, next) {
  const orderId = Number(req.params.orderId || req.params.id);
  if (!orderId || orderId <= 0) {
    return res.status(400).json({ error: 'ID de pedido inválido' });
  }

  const orderToken = req.headers['x-order-token'] || (req.body && req.body.orderToken);
  if (!orderToken || typeof orderToken !== 'string' || !orderToken.trim()) {
    return res.status(401).json({ error: 'Token de pedido requerido' });
  }

  try {
    const result = await query('SELECT order_token FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const storedToken = result.rows[0].order_token;
    if (!storedToken || storedToken !== orderToken.trim()) {
      return res.status(403).json({ error: 'Token de pedido inválido' });
    }
    next();
  } catch (err) {
    logger.error({ err: err.message }, 'Error validando order_token');
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { requireOrderToken };
