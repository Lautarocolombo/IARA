const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);

    const [salesToday, salesWeek, salesMonth, pendingOrders, lowStock, unreadContacts, allOrders] = await Promise.all([
      query("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND date(created_at) = $1", [today]),
      query("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND created_at >= $1", [weekStart.toISOString()]),
      query("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND created_at >= $1", [monthStart.toISOString()]),
      query("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'confirmed', 'preparing')"),
      query("SELECT COUNT(*) as count FROM products WHERE stock > 0 AND stock <= 5"),
      query("SELECT COUNT(*) as count FROM contacts WHERE status = 'new'"),
      query("SELECT items, total, status FROM orders WHERE status != 'cancelled'")
    ]);

    const productQty = {};
    const categoryTotal = {};
    for (const o of allOrders.rows) {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      for (const it of items) {
        const pid = it.id || it.product_id;
        const qty = it.quantity || 1;
        productQty[pid] = (productQty[pid] || 0) + qty;
      }
    }

    const productsMap = {};
    try {
      const products = await query('SELECT id, name, category FROM products');
      products.rows.forEach(p => { productsMap[p.id] = p; });
    } catch (e) {
      logger.warn('No se pudo cargar productos para dashboard', e.message);
    }

    let topProduct = null;
    let maxQty = 0;
    for (const pid of Object.keys(productQty)) {
      if (productQty[pid] > maxQty) {
        maxQty = productQty[pid];
        topProduct = { id: pid, name: productsMap[pid]?.name || 'Producto #' + pid, total_qty: productQty[pid] };
      }
    }

    for (const o of allOrders.rows) {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      for (const it of items) {
        const p = productsMap[it.id];
        if (p && p.category) {
          categoryTotal[p.category] = (categoryTotal[p.category] || 0) + Number(o.total || 0);
        }
      }
    }

    let topCategory = null;
    let maxCatTotal = 0;
    for (const cat of Object.keys(categoryTotal)) {
      if (categoryTotal[cat] > maxCatTotal) {
        maxCatTotal = categoryTotal[cat];
        topCategory = { category: cat, total: categoryTotal[cat] };
      }
    }

    const salesTrend = await query("SELECT date(created_at) as date, SUM(total) as total FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-7 day') GROUP BY date(created_at) ORDER BY date ASC");

    res.json({
      sales: {
        today: salesToday.rows[0] || { total: 0, count: 0 },
        week: salesWeek.rows[0] || { total: 0, count: 0 },
        month: salesMonth.rows[0] || { total: 0, count: 0 },
        trend: salesTrend.rows
      },
      pendingOrders: pendingOrders.rows[0]?.count || 0,
      lowStock: lowStock.rows[0]?.count || 0,
      unreadContacts: unreadContacts.rows[0]?.count || 0,
      topProduct,
      topCategory
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo estadísticas del dashboard');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getSalesReport = async (req, res) => {
  const startDate = String(req.query.start_date || '');
  const endDate = String(req.query.end_date || '');
  let where = "WHERE status != 'cancelled'";
  const params = [];
  if (startDate) { params.push(startDate); where += ` AND date(created_at) >= $${params.length}`; }
  if (endDate) { params.push(endDate); where += ` AND date(created_at) <= $${params.length}`; }
  try {
    const [sales, allOrders, products] = await Promise.all([
      query(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders ${where}`, params),
      query(`SELECT items, total, status FROM orders ${where}`, params),
      query('SELECT id, name, category FROM products')
    ]);

    const productsMap = {};
    products.rows.forEach(p => { productsMap[p.id] = p; });

    const byProduct = {};
    const byCategory = {};
    const byStatus = {};

    for (const o of allOrders.rows) {
      const status = o.status || 'pending';
      byStatus[status] = (byStatus[status] || { count: 0, total: 0 });
      byStatus[status].count += 1;
      byStatus[status].total += Number(o.total || 0);

      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      for (const it of items) {
        const p = productsMap[it.id];
        const name = p ? p.name : 'Producto #' + it.id;
        const cat = p ? p.category : 'Sin categoría';
        const qty = it.quantity || 1;

        byProduct[name] = byProduct[name] || { name, qty: 0, total: 0 };
        byProduct[name].qty += qty;
        byProduct[name].total += Number(o.total || 0);

        byCategory[cat] = byCategory[cat] || { category: cat, total: 0, orders: 0 };
        byCategory[cat].total += Number(o.total || 0);
        byCategory[cat].orders += 1;
      }
    }

    res.json({
      sales: sales.rows[0],
      byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byStatus: Object.values(byStatus).map(s => ({ status: s.status || 'pending', count: s.count, total: s.total }))
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo reporte de ventas');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getDashboardStats, getSalesReport };
