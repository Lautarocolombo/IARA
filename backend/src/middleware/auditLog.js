const { query } = require('../lib/db');
const logger = require('../lib/logger');

function logActivity(username, action, entityType = '', entityId = 0, details = '', ip = '', relatedOrderId = 0, tenantId = 'default') {
  try {
    query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, ip, related_order_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [username, action, entityType, entityId, details, ip, relatedOrderId, tenantId]
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Error guardando activity_log');
  }
}

function auditLog(action, entityType, entityIdParam = 'id') {
  return (req, res, next) => {
    const originalSend = res.json.bind(res);
    const username = req.user?.username || 'unknown';
    const ip = req.ip || req.connection?.remoteAddress || '';
    const tenantId = req.tenant?.id || 'default';
    const entityId = req.params[entityIdParam] || req.body?.id || 0;

    res.json = function(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logActivity(username, action, entityType, Number(entityId), JSON.stringify(body).slice(0, 500), ip, req.body?.orderId || 0, tenantId);
      }
      return originalSend(body);
    };

    next();
  };
}

module.exports = { logActivity, auditLog };
