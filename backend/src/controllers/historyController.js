const { transaction } = require('../lib/db');
const logger = require('../lib/logger');
const { logAudit } = require('../lib/audit');
const { backupPostgres, backupSqlite } = require('../scripts/backup');

async function createBackupBeforeDangerousOp(req, action) {
  try {
    const isLocal = !process.env.DATABASE_URL;
    const dest = isLocal ? await backupSqlite() : await backupPostgres();
    logger.info({ dest, action, user: req.user?.user || 'admin' }, 'Backup creado antes de operación destructiva');
    return dest;
  } catch (err) {
    logger.warn({ err: err.message, action }, 'No se pudo crear backup previo, continuando sin backup');
    return null;
  }
}

const clearHistory = async (req, res) => {
  try {
<<<<<<< HEAD
    // Doble confirmación también en el servidor: sin { confirm: 'ELIMINAR' }
    // no se borra nada (el panel pide escribir ELIMINAR en 2 pasos).
    if (!req.body || req.body.confirm !== 'ELIMINAR') {
      return res.status(400).json({ error: 'Falta confirmación. Enviá { confirm: "ELIMINAR" } para borrar el historial.' });
    }
=======
    // Crear backup automático antes de eliminar
    await createBackupBeforeDangerousOp(req, 'clear_history');

>>>>>>> b091ff6922619009f758fa515ba900a6999ea8b7
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