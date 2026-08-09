const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');

const WEEKLY_BAJA_THRESHOLD = 300;
const WEEKLY_MEDIA_THRESHOLD = 800;

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

const resetMetrics = async (req, res) => {
  try {
    await query('CREATE TABLE IF NOT EXISTS archived_orders (id INTEGER, items JSONB, total REAL, customer JSONB, status TEXT, notes TEXT, shipping_name TEXT, shipping_address TEXT, shipping_phone TEXT, shipping_zip TEXT, shipping_city TEXT, shipping_email TEXT, subtotal REAL DEFAULT 0, shipping_cost REAL DEFAULT 0, created_at TIMESTAMP, archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');

    const ordersResult = await query('SELECT * FROM orders ORDER BY id ASC');
    const allOrders = ordersResult.rows;

    if (allOrders.length > 0) {
      await transaction(async (txClient) => {
        for (const o of allOrders) {
          const itemsJson = typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []);
          const customerJson = typeof o.customer === 'string' ? o.customer : JSON.stringify(o.customer || {});
          await txClient.query(
            'INSERT INTO archived_orders (id, items, total, customer, status, notes, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
            [
              o.id,
              itemsJson,
              Number(o.total || 0),
              customerJson,
              o.status || 'pending',
              o.notes || '',
              o.shipping_name || '',
              o.shipping_address || '',
              o.shipping_phone || '',
              o.shipping_zip || '',
              o.shipping_city || '',
              o.shipping_email || '',
              Number(o.subtotal || 0),
              Number(o.shipping_cost || 0),
              new Date(o.created_at).toISOString()
            ]
          );
        }
      });

      for (const o of allOrders) {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        for (const it of items) {
          const productId = Number(it.id);
          const qty = Number(it.quantity || 1);
          await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [qty, productId]);
        }
      }
    }

    await query('DELETE FROM orders');
    res.json({ ok: true, archived: allOrders.length });
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

module.exports = { getSalesReport, getSalesTrend, resetMetrics, getWeeklySummary };
