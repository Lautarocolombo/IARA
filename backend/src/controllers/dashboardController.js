const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { safeJsonParse } = require('../lib/parser');

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const tenantCondition = "tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default')";

    const [
      salesToday,
      salesWeek,
      salesMonth,
      pendingOrders,
      lowStockProducts,
      recentOrders,
      activityLog
    ] = await Promise.all([
      // Ventas de hoy
      query(
        `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count 
         FROM orders 
         WHERE status != 'cancelled' AND date(created_at) = $1 AND ${tenantCondition}`,
        [todayStr]
      ),
      // Ventas de la semana
      query(
        `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count 
         FROM orders 
         WHERE status != 'cancelled' AND date(created_at) >= $1 AND ${tenantCondition}`,
        [weekAgoStr]
      ),
      // Ventas del mes
      query(
        `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count 
         FROM orders 
         WHERE status != 'cancelled' AND date(created_at) >= $1 AND ${tenantCondition}`,
        [monthStartStr]
      ),
      // Pedidos pendientes
      query(
        `SELECT COUNT(*) as count FROM orders 
         WHERE status = 'pending' AND deleted_at IS NULL AND ${tenantCondition}`
      ),
      // Productos con stock bajo (≤5)
      query(
        `SELECT id, name, stock, category, price FROM products 
         WHERE stock <= 5 AND stock >= 0 AND active = TRUE AND deleted = FALSE AND ${tenantCondition} 
         ORDER BY stock ASC, name ASC LIMIT 10`
      ),
      // Últimos 5 pedidos
      query(
        `SELECT id, status, total, shipping_name, created_at, customer 
         FROM orders 
         WHERE deleted_at IS NULL AND ${tenantCondition} 
         ORDER BY created_at DESC LIMIT 5`
      ),
      // Últimas 10 actividades
      query(
        `SELECT id, username, action, entity_type, entity_id, details, created_at 
         FROM activity_log 
         WHERE tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default') 
         ORDER BY created_at DESC LIMIT 10`
      )
    ]);

    const pendingCount = Number(pendingOrders.rows[0]?.count || 0);
    const lowStockCount = lowStockProducts.rows.length;

    // Preparar pedidos recientes con datos parseados
    const recentOrdersFormatted = recentOrders.rows.map(o => ({
      id: o.id,
      status: o.status,
      total: Number(o.total || 0),
      customerName: (() => {
        try {
          const cust = safeJsonParse(o.customer, {});
          return cust.name || o.shipping_name || 'Cliente';
        } catch { return o.shipping_name || 'Cliente'; }
      })(),
      createdAt: o.created_at
    }));

    res.json({
      sales: {
        today: {
          total: Number(salesToday.rows[0]?.total || 0),
          count: Number(salesToday.rows[0]?.count || 0)
        },
        week: {
          total: Number(salesWeek.rows[0]?.total || 0),
          count: Number(salesWeek.rows[0]?.count || 0)
        },
        month: {
          total: Number(salesMonth.rows[0]?.total || 0),
          count: Number(salesMonth.rows[0]?.count || 0)
        }
      },
      alerts: {
        pendingOrders: pendingCount,
        lowStockProducts: lowStockCount,
        lowStockList: lowStockProducts.rows.map(p => ({
          id: p.id,
          name: p.name,
          stock: Number(p.stock || 0),
          category: p.category,
          price: Number(p.price || 0)
        }))
      },
      recentOrders: recentOrdersFormatted,
      activityLog: activityLog.rows.map(a => ({
        id: a.id,
        username: a.username,
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        details: a.details,
        createdAt: a.created_at
      }))
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Error obteniendo stats del dashboard');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getDashboardStats };