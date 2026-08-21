const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');
const { logAudit } = require('../lib/audit');

const clearHistory = async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      let deletedProofs = 0;
      let deletedSales = 0;
      let deletedOrders = 0;
      let deletedReceipts = 0;
      let deletedOrderItems = 0;

      const receiptsResult = await client.query('DELETE FROM receipts');
      deletedReceipts = Number(receiptsResult.rowCount || 0);

      const proofsResult = await client.query('DELETE FROM payment_proofs');
      deletedProofs = Number(proofsResult.rowCount || 0);

      const orderItemsResult = await client.query('DELETE FROM order_items');
      deletedOrderItems = Number(orderItemsResult.rowCount || 0);

      const salesResult = await client.query('DELETE FROM sales');
      deletedSales = Number(salesResult.rowCount || 0);

      const ordersResult = await client.query('DELETE FROM orders');
      deletedOrders = Number(ordersResult.rowCount || 0);

      return { deletedProofs, deletedSales, deletedOrders, deletedReceipts, deletedOrderItems };
    });

    res.json({ ok: true, deleted: result });
    logAudit({
      user: req.user?.user || 'admin',
      action: 'clear_history',
      entityType: 'earnings',
      entityId: 0,
      details: 'Historial eliminado: ' + result.deletedOrders + ' pedidos, ' + result.deletedSales + ' ventas, ' + result.deletedProofs + ' comprobantes, ' + result.deletedReceipts + ' recibos, ' + result.deletedOrderItems + ' items',
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando historial');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { clearHistory };