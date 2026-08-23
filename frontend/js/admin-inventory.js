(() => {
  const API_BASE = (window.CONFIG && window.CONFIG.API && window.CONFIG.API.BASE) || '';
  const authHeader = () => {
    const token = window.getAuthToken ? window.getAuthToken() : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const $ = (sel) => document.querySelector(sel);

  async function loadMovements() {
    const product = ($('#invProductFilter') || {}).value || '';
    const limit = Number(($('#invLimit') || {}).value || 100);
    const tbody = $('#inventoryMovementsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-muted">Cargando...</td></tr>';

    const qs = new URLSearchParams();
    if (product) qs.set('productId', product);
    qs.set('limit', String(limit));
    qs.set('offset', '0');

    try {
      const res = await window.fetchWithRetry(`${API_BASE}/api/admin/inventory/movements?${qs.toString()}`, {
        headers: { 'Content-Type': 'application/json', ...authHeader() }
      });
      if (!res || !res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error cargando movimientos');
      }
      const data = await res.json();
      renderMovements(data.movements || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-muted">${err.message}</td></tr>`;
    }
  }

  function renderMovements(movements) {
    const tbody = $('#inventoryMovementsBody');
    if (!tbody) return;
    if (!movements.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-muted">Sin movimientos</td></tr>';
      return;
    }
    tbody.innerHTML = movements.map(m => `
      <tr>
        <td>${m.id}</td>
        <td>${escapeHtml(m.product_name || '—')}</td>
        <td>${escapeHtml(m.type || '')}</td>
        <td>${Number(m.quantity || 0)}</td>
        <td>${Number(m.previous_stock || 0)}</td>
        <td>${Number(m.new_stock || 0)}</td>
        <td>${escapeHtml(m.reason || '')}</td>
        <td>${escapeHtml(m.reference_id || '')}</td>
        <td>${m.created_at ? new Date(m.created_at).toLocaleString('es-AR') : ''}</td>
      </tr>
    `).join('');
  }

  async function loadAlerts() {
    const tbody = $('#inventoryAlertsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-muted">Cargando...</td></tr>';

    try {
      const res = await window.fetchWithRetry(`${API_BASE}/api/admin/inventory/alerts?resolved=false`, {
        headers: { 'Content-Type': 'application/json', ...authHeader() }
      });
      if (!res || !res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error cargando alertas');
      }
      const data = await res.json();
      renderAlerts(data.alerts || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-muted">${err.message}</td></tr>`;
    }
  }

  function renderAlerts(alerts) {
    const tbody = $('#inventoryAlertsBody');
    if (!tbody) return;
    if (!alerts.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-muted">Sin alertas</td></tr>';
      return;
    }
    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td>${a.id}</td>
        <td>${escapeHtml(a.product_name || '—')}</td>
        <td>${escapeHtml(a.sku || '')}</td>
        <td>${Number(a.current_stock || 0)}</td>
        <td>${escapeHtml(a.type || '')}</td>
        <td>${escapeHtml(a.message || '')}</td>
        <td>${a.resolved ? 'Resuelta' : 'Activa'}</td>
        <td>${a.created_at ? new Date(a.created_at).toLocaleString('es-AR') : ''}</td>
        <td>${a.resolved ? '' : `<button class="btn btn-primary btn-sm" data-resolve-alert="${a.id}">Resolver</button>`}</td>
      </tr>
    `).join('');
  }

  async function resolveAlert(id) {
    try {
      const res = await window.fetchWithRetry(`${API_BASE}/api/admin/inventory/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() }
      });
      if (!res || !res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error resolviendo alerta');
      }
      loadAlerts();
    } catch (err) {
      alert(err.message);
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindEvents() {
    const refreshMovements = $('#refreshInventoryBtn');
    if (refreshMovements) {
      refreshMovements.addEventListener('click', loadMovements);
    }
    const refreshAlerts = $('#refreshAlertsBtn');
    if (refreshAlerts) {
      refreshAlerts.addEventListener('click', loadAlerts);
    }
    const productFilter = $('#invProductFilter');
    if (productFilter) {
      productFilter.addEventListener('input', () => {
        clearTimeout(productFilter._debounce);
        productFilter._debounce = setTimeout(loadMovements, 300);
      });
    }
    const limitInput = $('#invLimit');
    if (limitInput) {
      limitInput.addEventListener('change', loadMovements);
    }

    const tbody = $('#inventoryAlertsBody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-resolve-alert]');
        if (!btn) return;
        const id = Number(btn.getAttribute('data-resolve-alert'));
        if (id) resolveAlert(id);
      });
    }
  }

  function init() {
    bindEvents();
    loadMovements();
    loadAlerts();
  }

  window.inventory = { loadMovements, loadAlerts, resolveAlert, escapeHtml };
  window.inventoryInit = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
