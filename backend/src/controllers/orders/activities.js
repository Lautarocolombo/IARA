const { query } = require('../../lib/db');
const logger = require('../../lib/logger');

async function logActivity(user, action, entityType = '', entityId = 0, details = '', ip = '', relatedOrderId = 0, tenantId = 'default', client) {
  try {
    await query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, ip, related_order_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [user, action, entityType, entityId, details, ip, relatedOrderId, tenantId],
      client
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Error guardando activity_log');
  }
}

async function addOrderActivity(req, res) {
  const orderId = Number(req.params.id);
  const { action, details } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Acción requerida' });
  try {
    const user = req.user?.user || 'admin';
    await logActivity(user, action, 'order', orderId, details || '', req.ip || '', orderId, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error agregando actividad del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getOrderActivities(req, res) {
  const orderId = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM activity_log WHERE related_order_id = $1 ORDER BY created_at ASC', [orderId]);
    res.json({ activities: result.rows });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo actividad del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { logActivity, addOrderActivity, getOrderActivities };