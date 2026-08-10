/* ==================== ADMIN DASHBOARD ==================== */

/* global loadShippingZones */

async function loadDashboardMetrics() {
  try {
    const res = await adminFetch('/api/admin/dashboard-metrics');
    if (!res) return;
    const data = await res.json();
    const metricOrders = document.getElementById('metricOrders');
    const metricRevenue = document.getElementById('metricRevenue');
    const metricTicket = document.getElementById('metricTicket');
    const metricProducts = document.getElementById('metricProducts');
    if (metricOrders) metricOrders.textContent = data.totalOrders || 0;
    if (metricRevenue) metricRevenue.textContent = formatARS(data.totalRevenue || 0);
    if (metricTicket) metricTicket.textContent = formatARS(data.averageTicket || 0);
    if (metricProducts) metricProducts.textContent = data.totalProducts || 0;
  } catch (e) {
    console.error('Error cargando métricas de dashboard:', e);
  }
}

window.loadDashboardMetrics = loadDashboardMetrics;
