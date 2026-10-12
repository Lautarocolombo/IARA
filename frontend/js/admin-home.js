/* ==================== ADMIN HOME.JS (Fase 4) ==================== */
/* Resumen del negocio: ventas hoy/semana/mes, pedidos pendientes,
   stock bajo, últimos pedidos y actividad reciente. Solo lectura. */

(function () {
  'use strict';

  function formatARS(value) {
    if (typeof window.formatARS === 'function') return window.formatARS(value);
    return '$' + Number(value || 0).toLocaleString('es-AR');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function (c) {
      var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return m[c] || c;
    });
  }

  function setMetric(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getClientName(order) {
    try {
      var customer = typeof order.customer === 'string' ? JSON.parse(order.customer) : (order.customer || {});
      return customer.name || order.shipping_name || 'Sin nombre';
    } catch (e) {
      return order.shipping_name || 'Sin nombre';
    }
  }

  function getStatusLabel(status) {
    var map = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      preparing: 'Preparando',
      shipped: 'Enviado',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    };
    return map[status] || status || '—';
  }

  async function fetchJson(url) {
    var res = await window.adminFetch(url, { method: 'GET' });
    if (!res || !res.ok) throw new Error('Error cargando ' + url);
    return res.json();
  }

  async function loadToday() {
    try {
      var data = await fetchJson('/api/v1/admin/reports/trend?days=1');
      var rows = Array.isArray(data) ? data : [];
      var total = rows.reduce(function (sum, r) { return sum + Number(r.total || 0); }, 0);
      setMetric('homeToday', formatARS(total));
    } catch (err) {
      setMetric('homeToday', '—');
    }
  }

  async function loadWeekMonth() {
    try {
      var weekly = await fetchJson('/api/v1/admin/reports/summary?view=weekly');
      setMetric('homeWeek', formatARS(weekly.total || 0));
    } catch (err) {
      setMetric('homeWeek', '—');
    }
    try {
      var monthly = await fetchJson('/api/v1/admin/reports/summary?view=monthly');
      var el = document.getElementById('homeMonth');
      if (el) el.textContent = formatARS(monthly.total || 0);
    } catch (err) {
      var monthEl = document.getElementById('homeMonth');
      if (monthEl) monthEl.textContent = '—';
    }
  }

  async function loadPending() {
    try {
      var data = await fetchJson('/api/v1/admin/orders?status=pending&limit=1');
      var count = typeof data.total === 'number' ? data.total : (data.orders || []).length;
      setMetric('homePending', String(count));
    } catch (err) {
      setMetric('homePending', '—');
    }
  }

  async function loadLowStock() {
    try {
      var data = await fetchJson('/api/v1/admin/inventory/alerts?resolved=false');
      var alerts = data.alerts || [];
      setMetric('homeLowStock', String(alerts.length));
    } catch (err) {
      setMetric('homeLowStock', '—');
    }
  }

  async function loadLatestOrders() {
    var tbody = document.getElementById('homeOrdersBody');
    var empty = document.getElementById('homeOrdersEmpty');
    if (!tbody) return;
    try {
      var data = await fetchJson('/api/v1/admin/orders?limit=5');
      var orders = data.orders || [];
      if (!orders.length) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');
      tbody.innerHTML = orders.map(function (o) {
        return '<tr>' +
          '<td>#' + o.id + '</td>' +
          '<td>' + escapeHtml(getClientName(o)) + '</td>' +
          '<td class="text-center"><span class="status-badge status-' + escapeHtml(o.status || '') + '">' + escapeHtml(getStatusLabel(o.status)) + '</span></td>' +
          '<td class="text-right">' + formatARS(o.total) + '</td>' +
        '</tr>';
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="4" class="error-row">No se pudieron cargar los pedidos.</td></tr>';
    }
  }

  async function loadActivity() {
    var list = document.getElementById('homeActivityList');
    var empty = document.getElementById('homeActivityEmpty');
    if (!list) return;
    try {
      var data = await fetchJson('/api/v1/admin/activity-log?limit=8');
      var items = data.activities || data.logs || data.rows || [];
      if (!items.length) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');
      list.innerHTML = items.map(function (a) {
        var date = a.created_at ? new Date(a.created_at).toLocaleString('es-AR') : '';
        var title = a.action || a.title || 'Actividad';
        var desc = a.details || a.description || '';
        return '<div class="activity-item">' +
          '<div class="activity-marker"></div>' +
          '<div class="activity-body">' +
            '<div class="activity-title">' + escapeHtml(String(title)) + '</div>' +
            (desc ? '<div class="activity-desc">' + escapeHtml(String(desc)).substring(0, 120) + '</div>' : '') +
            (date ? '<div class="activity-date">' + escapeHtml(date) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    } catch (err) {
      list.innerHTML = '<p class="text-muted">No se pudo cargar la actividad.</p>';
    }
  }

  async function loadHome() {
    var btn = document.getElementById('refreshHomeBtn');
    var btnText = document.getElementById('refreshHomeBtnText');
    var btnLoading = document.getElementById('refreshHomeBtnLoading');
    if (btn) btn.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnLoading) btnLoading.classList.remove('hidden');

    setMetric('homeToday', '…');
    setMetric('homeWeek', '…');
    setMetric('homeMonth', '…');
    setMetric('homePending', '…');
    setMetric('homeLowStock', '…');

    try {
      await Promise.all([
        loadToday(),
        loadWeekMonth(),
        loadPending(),
        loadLowStock(),
        loadLatestOrders(),
        loadActivity()
      ]);
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.classList.remove('hidden');
      if (btnLoading) btnLoading.classList.add('hidden');
    }
  }

  function initHomePanel() {
    var refreshBtn = document.getElementById('refreshHomeBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadHome);
    }
    document.querySelectorAll('[data-goto-section]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var section = btn.getAttribute('data-goto-section');
        if (section && typeof window.switchSection === 'function') {
          window.switchSection(section);
        }
      });
    });
    loadHome();
  }

  window.initHomePanel = initHomePanel;
  window.reloadHome = loadHome;
})();
