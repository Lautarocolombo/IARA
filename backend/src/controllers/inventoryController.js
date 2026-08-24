const { query } = require('../lib/db');
const logger = require('../lib/logger');

async function logInventoryMovement(productId, type, quantity, previousStock, newStock, reason, referenceId) {
  try {
    await query(
      `INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(current_setting('app.current_tenant', TRUE), 'default'))`,
      [productId, type, quantity, previousStock, newStock, reason || '', referenceId || '']
    );

    if (type === 'sale' || type === 'adjustment') {
      const threshold = 5;
      if (newStock <= threshold && previousStock > threshold) {
        await query(
          `INSERT INTO inventory_alerts (product_id, type, message, tenant_id)
           VALUES ($1, 'low_stock', $2, COALESCE(current_setting('app.current_tenant', TRUE), 'default'))`,
          [productId, `Stock bajo para producto #${productId}: ${newStock} unidades (umbral: ${threshold})`]
        );
      } else if (newStock === 0 && previousStock > 0) {
        await query(
          `INSERT INTO inventory_alerts (product_id, type, message, tenant_id)
           VALUES ($1, 'out_of_stock', $2, COALESCE(current_setting('app.current_tenant', TRUE), 'default'))`,
          [productId, `Producto #${productId} sin stock`]
        );
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, productId }, 'No se pudo registrar movimiento de inventario');
  }
}

const getInventoryMovements = async (req, res) => {
  try {
    const productId = req.query.productId ? Number(req.query.productId) : null;
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;

    let where = '';
    const params = [];
    if (productId) {
      where = 'WHERE m.product_id = $1';
      params.push(productId);
    }

    const result = await query(
      `SELECT m.*, p.name as product_name, p.sku
       FROM inventory_movements m
       LEFT JOIN products p ON p.id = m.product_id
       ${where}
       ORDER BY m.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM inventory_movements m ${where}`,
      params
    );

    res.json({
      movements: result.rows,
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo movimientos de inventario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getInventoryAlerts = async (req, res) => {
  try {
    const tableCheck = await query(
      `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_name = 'inventory_alerts' AND table_schema = 'public'`
    );
    if (tableCheck.rows[0].count === 0) {
      return res.json({ alerts: [] });
    }

    const resolved = req.query.resolved === 'true';
    const result = await query(
      `SELECT a.*, p.name as product_name, p.sku, p.stock as current_stock
       FROM inventory_alerts a
       LEFT JOIN products p ON p.id = a.product_id
       WHERE a.resolved = $1
       ORDER BY a.created_at DESC`,
      [resolved]
    );

    res.json({ alerts: result.rows });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, sqlState: err.code }, 'Error obteniendo alertas de inventario');
    res.status(500).json({ error: 'Error interno del servidor', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};

const resolveInventoryAlert = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query(
      'UPDATE inventory_alerts SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    res.json({ alert: result.rows[0] });
  } catch (err) {
    logger.error({ err: err.message }, 'Error resolviendo alerta de inventario');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  logInventoryMovement,
  getInventoryMovements,
  getInventoryAlerts,
  resolveInventoryAlert
};
