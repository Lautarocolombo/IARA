const { query } = require('../lib/db');
const { isLocal } = require('../lib/db');
const logger = require('../lib/logger');
const { safeJsonParse } = require('../lib/parser');

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));

const getEarnings = async (req, res) => {
  try {
    const { start_date, end_date, page = 1, limit = 15 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    if (start_date && !isValidDate(start_date)) {
      return res.status(400).json({ error: 'start_date debe ser una fecha válida en formato YYYY-MM-DD' });
    }
    if (end_date && !isValidDate(end_date)) {
      return res.status(400).json({ error: 'end_date debe ser una fecha válida en formato YYYY-MM-DD' });
    }
    if (start_date && end_date && start_date > end_date) {
      return res.status(400).json({ error: 'start_date no puede ser posterior a end_date' });
    }

    const whereClauses = [];
    const whereParams = [];
    if (start_date) {
      whereParams.push(start_date);
      whereClauses.push('substr(created_at, 1, 10) >= $' + whereParams.length);
    }
    if (end_date) {
      whereParams.push(end_date);
      whereClauses.push('substr(created_at, 1, 10) <= $' + whereParams.length);
    }
    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : 'WHERE TRUE';

    let resetAt = null;
    try {
      const resetResult = await query("SELECT value FROM site_settings WHERE key = 'metrics_reset_at' AND tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default')");
      const resetRow = resetResult.rows[0];
      if (resetRow && resetRow.value) {
        resetAt = new Date(resetRow.value);
      }
    } catch (e) {
      resetAt = null;
    }

    const kpiWhereClauses = Array.from(whereClauses);
    const kpiWhereParams = Array.from(whereParams);
    if (resetAt) {
      kpiWhereParams.push(resetAt.toISOString());
      kpiWhereClauses.push('created_at > $' + kpiWhereParams.length);
    }
    const kpiWhereSql = kpiWhereClauses.length ? 'WHERE ' + kpiWhereClauses.join(' AND ') : 'WHERE TRUE';

    const countResult = await query('SELECT COUNT(*) as total FROM orders ' + kpiWhereSql, kpiWhereParams);
    const totalOrders = Number(countResult.rows[0]?.total || 0);

    const ordersTotalResult = await query('SELECT COALESCE(SUM(total),0) as total FROM orders ' + kpiWhereSql, kpiWhereParams);
    const ordersTotal = Number(ordersTotalResult.rows[0]?.total || 0);

    const limitIdx = whereParams.length + 1;
    const offsetIdx = whereParams.length + 2;
    const ordersResult = await query(
      'SELECT o.id, o.total, o.subtotal, o.shipping_cost, o.status, o.created_at, o.shipping_name, o.items, o.payment_method, o.shipping_city FROM orders o ' + whereSql + ' ORDER BY o.created_at DESC LIMIT $' + limitIdx + ' OFFSET $' + offsetIdx,
      [...whereParams, limitNum, offset]
    );

    const salesWhereClauses = [];
    const salesParams = [];
    if (start_date) {
      salesParams.push(start_date);
      salesWhereClauses.push('substr(sale_date, 1, 10) >= $' + salesParams.length);
    }
    if (end_date) {
      salesParams.push(end_date);
      salesWhereClauses.push('substr(sale_date, 1, 10) <= $' + salesParams.length);
    }
    const salesWhereSql = salesWhereClauses.length ? 'WHERE ' + salesWhereClauses.join(' AND ') : '';

    const kpiSalesWhereClauses = Array.from(salesWhereClauses);
    const kpiSalesParams = Array.from(salesParams);
    if (resetAt) {
      kpiSalesParams.push(resetAt.toISOString().split('T')[0]);
      kpiSalesWhereClauses.push('sale_date > $' + kpiSalesParams.length);
    }
    const kpiSalesWhereSql = kpiSalesWhereClauses.length ? 'WHERE ' + kpiSalesWhereClauses.join(' AND ') : '';

    const manualSalesTotalResult = await query('SELECT COALESCE(SUM(total),0) as total FROM sales ' + kpiSalesWhereSql, kpiSalesParams);
    const manualSalesTotal = Number(manualSalesTotalResult.rows[0]?.total || 0);

    const manualSalesResult = await query(
      'SELECT s.id, s.total, s.quantity, s.sale_date, s.created_at, p.name as product_name, \'manual\' as source FROM sales s LEFT JOIN products p ON p.id = s.product_id ' + salesWhereSql + ' ORDER BY s.created_at DESC LIMIT $' + (salesParams.length + 1) + ' OFFSET $' + (salesParams.length + 2),
      [...salesParams, limitNum, offset]
    );
    const totalRevenue = ordersTotal + manualSalesTotal;
    const avgOrderValue = totalOrders > 0 ? ordersTotal / totalOrders : 0;

    const monthWhereClauses = [];
    const monthWhereParams = [];
    if (start_date) {
      monthWhereParams.push(start_date);
      monthWhereClauses.push('substr(created_at, 1, 10) >= $' + monthWhereParams.length);
    }
    if (end_date) {
      monthWhereParams.push(end_date);
      monthWhereClauses.push('substr(created_at, 1, 10) <= $' + monthWhereParams.length);
    }

    const chartWhereClauses = Array.from(monthWhereClauses);
    const chartWhereParams = Array.from(monthWhereParams);
    if (resetAt) {
      chartWhereParams.push(resetAt.toISOString());
      chartWhereClauses.push('created_at > $' + chartWhereParams.length);
    }
    const chartWhereSql = chartWhereClauses.length ? 'WHERE ' + chartWhereClauses.join(' AND ') : '';

    var monthExpr = 'substr(created_at, 1, 7)';
    if (!isLocal) {
      monthExpr = 'to_char(created_at, \'YYYY-MM\')';
    }

    const chartResult = await query(
      'SELECT ' + monthExpr + ' as month, SUM(total) as total FROM orders ' + chartWhereSql + ' GROUP BY month ORDER BY month ASC',
      chartWhereParams
    );

    const categoryMap = {};
    ordersResult.rows.forEach(function (o) {
      var items = safeJsonParse(o.items, []);
      items.forEach(function (item) {
        var catName = item.category_name || 'Sin categoría';
        var catSlug = item.category_slug || 'sin-categoria';
        var key = catSlug;
        if (!categoryMap[key]) categoryMap[key] = { name: catName, slug: catSlug, total: 0 };
        categoryMap[key].total += Number(item.price || 0) * Number(item.quantity || 0);
      });
    });

    var categoryResult = {
      rows: Object.keys(categoryMap).map(function (key) {
        return categoryMap[key];
      }).sort(function (a, b) { return b.total - a.total; })
    };

    const manualSalesCountResult = await query('SELECT COUNT(*) as total FROM sales ' + salesWhereSql, salesParams);
    const manualSalesCount = Number(manualSalesCountResult.rows[0]?.total || 0);

    res.json({
      kpis: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        manualSalesTotal
      },
      chart: chartResult.rows,
      categories: categoryResult.rows,
      transactions: ordersResult.rows.map(function (o) {
        var items = [];
        try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch (e) { items = []; }
        return {
          id: o.id,
          type: 'order',
          total: Number(o.total || 0),
          status: o.status,
          date: o.created_at,
          customer: o.shipping_name || 'Cliente',
          items_count: items.length
        };
      }).concat(manualSalesResult.rows.map(function (s) {
        return {
          id: 'V-' + s.id,
          type: 'manual',
          total: Number(s.total || 0),
          status: 'completed',
          date: s.created_at,
          customer: s.product_name || 'Venta manual',
          items_count: Number(s.quantity || 0)
        };
      })).sort(function (a, b) { return new Date(b.date) - new Date(a.date); }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalOrders + manualSalesCount,
        pages: Math.ceil((totalOrders + manualSalesCount) / limitNum)
      }
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, query: req.query }, 'Error obteniendo métricas de ganancias');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getEarnings };
