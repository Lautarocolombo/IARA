const { query } = require('../lib/db');

function parseDateOrDefault(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// Órdenes que cuentan como "venta real" para reportes — no incluye
// pendientes, rechazadas ni canceladas.
const REVENUE_STATUSES = ['approved', 'in_process', 'shipped', 'delivered'];

async function getSalesSummary(req, res) {
  try {
    const to = parseDateOrDefault(req.query.to, new Date());
    const from = parseDateOrDefault(req.query.from, new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000));

    const placeholders = REVENUE_STATUSES.map((_, i) => `$${i + 3}`).join(', ');
    const result = await query(
      `SELECT id, total, subtotal, shipping_cost, discount, items, status, created_at
       FROM orders
       WHERE created_at >= $1 AND created_at <= $2 AND status IN (${placeholders})
       ORDER BY created_at ASC`,
      [from.toISOString(), to.toISOString(), ...REVENUE_STATUSES]
    );

    const orders = result.rows;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Ventas por día para un gráfico simple de barras en el panel.
    const byDay = {};
    for (const o of orders) {
      const day = String(o.created_at).slice(0, 10);
      if (!byDay[day]) byDay[day] = { day, orders: 0, revenue: 0 };
      byDay[day].orders += 1;
      byDay[day].revenue += Number(o.total || 0);
    }

    // Productos más vendidos, parseando el JSON de items de cada orden.
    const productTotals = {};
    for (const o of orders) {
      let items = [];
      try { items = JSON.parse(o.items || '[]'); } catch (e) { continue; }
      for (const it of items) {
        const key = it.id ?? it.name;
        if (!productTotals[key]) {
          productTotals[key] = { id: it.id, name: it.name, quantity: 0, revenue: 0 };
        }
        const qty = Number(it.quantity || it.qty || 1);
        productTotals[key].quantity += qty;
        productTotals[key].revenue += Number(it.total || (it.unit_price || 0) * qty);
      }
    }
    const topProducts = Object.values(productTotals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      totalRevenue,
      totalOrders,
      avgTicket,
      byDay: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)),
      topProducts
    });
  } catch (err) {
    console.error('Error generando reporte de ventas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getInventoryMovements(req, res) {
  try {
    const productId = req.query.product_id ? Number(req.query.product_id) : null;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const params = [];
    let where = '';
    if (productId) {
      params.push(productId);
      where = 'WHERE im.product_id = $1';
    }
    params.push(limit);

    const result = await query(
      `SELECT im.id, im.product_id, p.name AS product_name, im.type, im.quantity,
              im.previous_stock, im.new_stock, im.order_id, im.notes, im.created_at
       FROM inventory_movements im
       LEFT JOIN products p ON p.id = im.product_id
       ${where}
       ORDER BY im.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo movimientos de inventario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getSalesSummary, getInventoryMovements };
