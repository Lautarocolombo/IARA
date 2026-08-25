const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { safeJsonParse } = require('../lib/parser');
const { logAudit } = require('../lib/audit');

const WEEKLY_BAJA_THRESHOLD = 300;
const WEEKLY_MEDIA_THRESHOLD = 800;

async function getMetricsResetAt() {
  try {
    const result = await query("SELECT value FROM site_settings WHERE key = 'metrics_reset_at' AND tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default')");
    const row = result.rows[0];
    return row && row.value ? new Date(row.value) : null;
  } catch (err) {
    return null;
  }
}

const getSalesReport = async (req, res) => {
  const startDate = String(req.query.start_date || '');
  const endDate = String(req.query.end_date || '');
  const period = req.query.period || '';
  let where = 'WHERE status != \'cancelled\'';
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
      query(`SELECT items, total, subtotal, shipping_cost, coupon_discount, status FROM orders ${where}`, params),
      query('SELECT id, name, category FROM products')
    ]);

    const productsMap = {};
    products.rows.forEach(p => { productsMap[p.id] = p; });

    const byProduct = {};
    const byCategory = {};
    const byStatus = {};
    let grossTotal = 0;
    let netTotal = 0;

    for (const o of allOrders.rows) {
      const status = o.status || 'pending';
      if (!byStatus[status]) byStatus[status] = { status, count: 0, total: 0 };
      byStatus[status].count += 1;
      byStatus[status].total += Number(o.total || 0);

      grossTotal += Number(o.total || 0);
      netTotal += Math.max(0, Number(o.subtotal || 0) - Number(o.coupon_discount || 0));

      const items = safeJsonParse(o.items, []);
      const categorySeen = new Set();
      for (const it of items) {
        const p = productsMap[it.id];
        const name = p ? p.name : 'Producto #' + it.id;
        const cat = p ? p.category : 'Sin categoría';
        const qty = it.quantity || 1;
        const itemTotal = Number(it.price || 0) * qty;

        if (!byProduct[name]) byProduct[name] = { name, qty: 0, total: 0 };
        byProduct[name].qty += qty;
        byProduct[name].total += itemTotal;

        if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, orders: 0 };
        byCategory[cat].total += itemTotal;
        categorySeen.add(cat);
      }
      for (const cat of categorySeen) {
        byCategory[cat].orders += 1;
      }
    }

    res.json({
      sales: { ...sales.rows[0], gross: grossTotal, net: Math.round(netTotal * 100) / 100 },
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

const resetMetrics = async (req, res) => {
  try {
    const { confirm } = req.body || {};
    if (!confirm) {
      return res.status(400).json({ error: 'Falta confirmación. Enviá { confirm: true } en el body para confirmar el reseteo.' });
    }

    const result = await query(
      "INSERT INTO site_settings (key, value, tenant_id) VALUES ('metrics_reset_at', $1, COALESCE(current_setting('app.current_tenant', TRUE), 'default')) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP",
      [new Date().toISOString()]
    );

    res.json({ ok: true, resetAt: result.rows[0]?.value || new Date().toISOString() });
    logAudit({
      user: req.user?.user || 'admin',
      action: 'reset',
      entityType: 'reports',
      entityId: 0,
      details: 'Métricas reiniciadas desde ' + new Date().toISOString(),
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error({ err: err.message }, 'Error reiniciando métricas');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getWeeklySummary = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const weekResult = await query(
      'SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE status != \'cancelled\' AND date(created_at) >= $1',
      [sevenDaysAgoStr]
    );
    const pedidosSemana = Number(weekResult.rows[0].count || 0);
    const totalSemana = Number(weekResult.rows[0].total || 0);

    const previousWeeksResult = await query(
      'SELECT date(created_at) as date, COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE status != \'cancelled\' AND date(created_at) < $1 GROUP BY date(created_at) ORDER BY date ASC',
      [sevenDaysAgoStr]
    );

    let nivelVentas = 'Media';
    const previousRows = previousWeeksResult.rows || [];
    if (previousRows.length > 0) {
      const totalAnterior = previousRows.reduce((sum, r) => sum + Number(r.total || 0), 0);
      const semanasAnteriores = Math.max(1, Math.floor(previousRows.length / 7));
      const promedioSemanasAnteriores = totalAnterior / semanasAnteriores;
      if (promedioSemanasAnteriores > 0) {
        if (totalSemana > promedioSemanasAnteriores * 1.2) {
          nivelVentas = 'Alta';
        } else if (totalSemana < promedioSemanasAnteriores * 0.8) {
          nivelVentas = 'Baja';
        } else {
          nivelVentas = 'Media';
        }
      } else {
        if (totalSemana > WEEKLY_MEDIA_THRESHOLD) {
          nivelVentas = 'Alta';
        } else if (totalSemana >= WEEKLY_BAJA_THRESHOLD) {
          nivelVentas = 'Media';
        } else {
          nivelVentas = 'Baja';
        }
      }
    } else {
      if (totalSemana > WEEKLY_MEDIA_THRESHOLD) {
        nivelVentas = 'Alta';
      } else if (totalSemana >= WEEKLY_BAJA_THRESHOLD) {
        nivelVentas = 'Media';
      } else {
        nivelVentas = 'Baja';
      }
    }

    res.json({
      pedidosSemana,
      totalSemana,
      nivelVentas
    });
  } catch (err) {
    logger.error('Error obteniendo resumen semanal:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getSalesSummary = async (req, res) => {
  const view = req.query.view === 'monthly' ? 'monthly' : 'weekly';

  const now = new Date();
  let startDate = new Date(now);
  if (view === 'weekly') {
    startDate.setDate(startDate.getDate() - 56);
  } else {
    startDate.setMonth(startDate.getMonth() - 12);
  }
  const startDateStr = startDate.toISOString().split('T')[0];

  try {
    const resetAt = await getMetricsResetAt();
    const resetAtIso = resetAt ? resetAt.toISOString() : null;

    let ordersQuery;
    let ordersParams;
    if (resetAtIso) {
      ordersQuery = "SELECT created_at as date, total FROM orders WHERE status != 'cancelled' AND created_at > $1";
      ordersParams = [resetAtIso];
    } else {
      ordersQuery = "SELECT created_at as date, total FROM orders WHERE status != 'cancelled' AND date(created_at) >= $1";
      ordersParams = [startDateStr];
    }
    const ordersResult = await query(ordersQuery + ' ORDER BY date ASC', ordersParams);

    let salesQuery;
    let salesParams;
    if (resetAtIso) {
      salesQuery = "SELECT sale_date as date, total FROM sales WHERE sale_date > $1";
      salesParams = [resetAtIso.split('T')[0]];
    } else {
      salesQuery = 'SELECT sale_date as date, total FROM sales WHERE date(sale_date) >= $1';
      salesParams = [startDateStr];
    }
    const salesResult = await query(salesQuery + ' ORDER BY date ASC', salesParams);

    const rawData = [
      ...ordersResult.rows.map(r => ({ date: r.date, total: Number(r.total || 0) })),
      ...salesResult.rows.map(r => ({ date: r.date, total: Number(r.total || 0) }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let groups;
    if (view === 'weekly') {
      groups = groupByWeek(rawData, startDate);
    } else {
      groups = groupByMonth(rawData, startDate);
    }

    const total = groups.reduce((sum, g) => sum + g.total, 0);
    const count = groups.reduce((sum, g) => sum + g.count, 0);

    res.json({
      view,
      groups,
      total: Math.round(total * 100) / 100,
      count,
      ticketPromedio: count > 0 ? Math.round((total / count) * 100) / 100 : 0
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo resumen de ventas');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function groupByWeek(rawData, _startDate) {
  const weeks = [];
  const now = new Date();

  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const label = `${formatDate(weekStart)} — ${formatDate(weekEnd)}`;
    weeks.push({ label, start: weekStart, end: weekEnd, total: 0, count: 0, date: formatDate(weekStart) });
  }

  rawData.forEach(row => {
    const d = new Date(row.date);
    if (isNaN(d.getTime())) return;
    for (const w of weeks) {
      if (d >= w.start && d <= w.end) {
        w.total += row.total || 0;
        w.count += 1;
        break;
      }
    }
  });

  return weeks.map(w => ({
    label: w.label,
    date: w.date,
    total: Math.round(w.total * 100) / 100,
    count: w.count
  }));
}

function groupByMonth(rawData, _startDate) {
  const months = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const label = `${monthStart.toLocaleString('es-AR', { month: 'short' })} ${year}`;
    months.push({ label, start: monthStart, end: monthEnd, total: 0, count: 0, date: `${year}-${String(month + 1).padStart(2, '0')}` });
  }

  rawData.forEach(row => {
    const d = new Date(row.date);
    if (isNaN(d.getTime())) return;
    for (const m of months) {
      if (d >= m.start && d <= m.end) {
        m.total += row.total || 0;
        m.count += 1;
        break;
      }
    }
  });

  return months.map(m => ({
    label: m.label,
    date: m.date,
    total: Math.round(m.total * 100) / 100,
    count: m.count
  }));
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { getSalesReport, getSalesTrend, resetMetrics, getWeeklySummary, getSalesSummary };

