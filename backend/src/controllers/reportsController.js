const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getSalesReport = async (req, res) => {
  const startDate = String(req.query.start_date || '');
  const endDate = String(req.query.end_date || '');
  const period = req.query.period || '';
  let where = "WHERE status != 'cancelled'";
  const params = [];

  const computedStart = computeStartDate(period, startDate);
  const computedEnd = endDate || '';

  if (computedStart) { params.push(computedStart); where += ` AND date(created_at) >= $${params.length}`; }
  if (computedEnd) { params.push(computedEnd); where += ` AND date(created_at) <= $${params.length}`; }

  try {
    const [sales, dailyTrend, allOrders, products] = await Promise.all([
      query(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders ${where}`, params),
      query(
        `SELECT date(created_at) as date, COALESCE(SUM(total),0) as total, COUNT(*) as count
         FROM orders ${where}
         GROUP BY date(created_at) ORDER BY date ASC`,
        params
      ),
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
      if (!byStatus[status]) byStatus[status] = { status, count: 0, total: 0 };
      byStatus[status].count += 1;
      byStatus[status].total += Number(o.total || 0);

      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      for (const it of items) {
        const p = productsMap[it.id];
        const name = p ? p.name : 'Producto #' + it.id;
        const cat = p ? p.category : 'Sin categoría';
        const qty = it.quantity || 1;

        if (!byProduct[name]) byProduct[name] = { name, qty: 0, total: 0 };
        byProduct[name].qty += qty;
        byProduct[name].total += Number(o.total || 0);

        if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, orders: 0 };
        byCategory[cat].total += Number(o.total || 0);
        byCategory[cat].orders += 1;
      }
    }

    res.json({
      sales: sales.rows[0],
      trend: dailyTrend.rows,
      byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byStatus: Object.values(byStatus).map(s => ({ status: s.status, count: s.count, total: s.total })),
      ticketPromedio: sales.rows[0].count > 0 ? Number(sales.rows[0].total / sales.rows[0].count) : 0
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo reporte de ventas');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function computeStartDate(period, explicit) {
  if (explicit) return explicit;
  const now = new Date();
  switch (period) {
    case 'today': {
      return now.toISOString().split('T')[0];
    }
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d.toISOString().split('T')[0];
    }
    default:
      return '';
  }
}

const getSalesTrend = async (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await query(
      `SELECT date(created_at) as date, COALESCE(SUM(total),0) as total, COUNT(*) as count
       FROM orders
       WHERE status != 'cancelled' AND created_at >= $1
       GROUP BY date(created_at) ORDER BY date ASC`,
      [cutoff.toISOString().split('T')[0]]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo tendencia:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSalesReport, getSalesTrend };
