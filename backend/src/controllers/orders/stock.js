const { query } = require('../../lib/db');
const logger = require('../../lib/logger');
const { safeJsonParse } = require('../../lib/parser');
const { logInventoryMovement } = require('../inventoryController');

async function restoreStockForOrder(items, client, tenantId = 'default') {
  const itemsArr = typeof items === 'string' ? JSON.parse(items) : items;
  if (!Array.isArray(itemsArr)) return;
  for (const item of itemsArr) {
    const productId = Number(item.id);
    const qty = Number(item.quantity || 1);
    await query('UPDATE products SET stock = stock + $1 WHERE id = $2 AND (tenant_id = $3 OR tenant_id = \'default\')', [qty, productId, tenantId], client);
  }
}

async function checkAndUpdateStock(validatedItems, tenantId, client) {
  for (const item of validatedItems) {
    logger.info('createOrder: consultando stock para producto', { itemId: item.id });
    const stockResult = await query('SELECT stock FROM products WHERE id = $1 AND (tenant_id = $3 OR tenant_id = \'default\')', [Number(item.id), 0, tenantId], client);
    if (stockResult.rows.length === 0) {
      throw new Error(`Producto ${item.id} no encontrado`);
    }
    const currentStock = stockResult.rows[0].stock;
    if (currentStock < item.quantity) {
      throw new Error(`Stock insuficiente para el producto ${item.id}. Disponible: ${currentStock ?? 0}, solicitado: ${item.quantity}`);
    }
    const newStock = currentStock - Number(item.quantity);
    await query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND (tenant_id = $3 OR tenant_id = \'default\')',
      [Number(item.quantity), Number(item.id), tenantId],
      client
    );
    logInventoryMovement(Number(item.id), 'sale', Number(item.quantity), currentStock, newStock, 'Venta', '').catch(() => {});
  }
}

async function restoreStockOnCancellation(orderId, tenantId, client) {
  const existing = await query('SELECT items, status FROM orders WHERE id = $1 AND deleted_at IS NULL AND (tenant_id = $2 OR tenant_id = \'default\')', [orderId, tenantId], client);
  if (existing.rows.length > 0 && existing.rows[0].status !== 'cancelled') {
    const items = safeJsonParse(existing.rows[0].items, []);
    for (const item of items) {
      const productId = Number(item.id);
      const qty = Number(item.quantity || 1);
      const stockResult = await query('SELECT stock FROM products WHERE id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')', [productId, tenantId], client);
      const currentStock = stockResult.rows[0]?.stock || 0;
      const newStock = currentStock + qty;
      await query('UPDATE products SET stock = stock + $1 WHERE id = $2 AND (tenant_id = $3 OR tenant_id = \'default\')', [qty, productId, tenantId], client);
      logInventoryMovement(productId, 'cancellation', qty, currentStock, newStock, 'Cancelación de pedido', String(orderId)).catch(() => {});
    }
  }
}

async function restoreStockOnBatchDelete(status, tenantId, client) {
  const ordersResult = await query('SELECT id, items, status FROM orders WHERE status = $1 AND deleted_at IS NULL AND (tenant_id = $2 OR tenant_id = \'default\')', [status, tenantId], client);
  const orders = ordersResult.rows;
  for (const order of orders) {
    const items = safeJsonParse(order.items, []);
    if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'cancelled') {
      await restoreStockForOrder(items, client, tenantId);
    }
  }
  return orders;
}

module.exports = { restoreStockForOrder, checkAndUpdateStock, restoreStockOnCancellation, restoreStockOnBatchDelete };