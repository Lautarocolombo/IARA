const { query } = require('../lib/db');
const logger = require('../lib/logger');

async function logAudit({ user, action, entityType, entityId, details, ip, tenantId = 'default' }) {
  try {
    await query(
      `INSERT INTO activity_log (username, action, entity_type, entity_id, details, ip, tenant_id, related_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
      [user || 'system', action, entityType, entityId, details || '', ip || '', tenantId]
    );
  } catch (err) {
    logger.warn({ err: err.message, audit: { action, entityType, entityId } }, 'Error guardando audit log');
  }
}

function auditMiddleware(action, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    let statusCode = 200;

    res.status = function (code) {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = function (body) {
      const user = req.user?.user || 'admin';
      const ip = req.ip || req.connection?.remoteAddress || '';
      const tenantId = req.headers['x-tenant-id'] || req.user?.tenant_id || 'default';
      const entityId = req.params?.id || req.params?.orderId || req.body?.id || 0;
      const details = `${action} ${entityType}${entityId ? ` ${entityId}` : ''}`;

      if (statusCode >= 200 && statusCode < 300) {
        logAudit({
          user,
          action,
          entityType,
          entityId,
          details,
          ip,
          tenantId,
          status: 'success'
        }).catch(() => {});
      } else if (statusCode >= 400) {
        logAudit({
          user,
          action,
          entityType,
          entityId,
          details: `${details} (failed: ${statusCode})`,
          ip,
          tenantId,
          status: 'failed'
        }).catch(() => {});
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = { logAudit, auditMiddleware };
