(function () {
  'use strict';

  async function loadTracking(orderId) {
    var container = document.getElementById('trackingContainer');
    var lookup = document.getElementById('trackingLookup');
    var fallback = document.getElementById('trackingFallback');
    if (!container) return;

    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/orders/${orderId}/track`, { method: 'GET' });
      if (!res) throw new Error('Error al cargar el pedido');
      const data = await res.json();
      if (!data || res.status === 404) {
        if (container) container.style.display = 'none';
        if (lookup) lookup.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
      }

      const order = data;
      const items = (() => { try { return JSON.parse(order.items || '[]'); } catch (e) { return []; } })();
      const statusMap = {
        pending: 'Esperando Comprobante',
        confirmed: 'Pago Confirmado',
        preparing: 'En Preparación',
        shipped: 'Enviado',
        delivered: 'Entregado',
        cancelled: 'Cancelado'
      };
      const statusLabel = statusMap[order.status] || order.status || 'Pendiente';
      const statusClass = 'status-' + (order.status || 'pending');

      const shipping = order.shipping_name || order.shipping_address ? `
        <div class="tracking-block">
          <h3>Datos de Envío</h3>
          <p><strong>Nombre:</strong> ${escapeHtml(order.shipping_name || '—')}</p>
          <p><strong>Dirección:</strong> ${escapeHtml(order.shipping_address || '—')}</p>
          <p><strong>Ciudad:</strong> ${escapeHtml(order.shipping_city || '—')}</p>
          <p><strong>Teléfono:</strong> ${escapeHtml(order.shipping_phone || '—')}</p>
          <p><strong>Email:</strong> ${escapeHtml(order.shipping_email || '—')}</p>
        </div>
      ` : '<div class="tracking-block"><h3>Datos de Envío</h3><p class="text-muted">Serán solicitados por WhatsApp</p></div>';

      container.innerHTML = `
        <div class="order-card">
          <div class="order-header">
            <div>
              <span class="order-id">Pedido #${order.id}</span>
              <span class="order-date">${new Date(order.created_at).toLocaleDateString('es-AR')}</span>
            </div>
            <span class="order-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="order-items">
            ${items.map(function(item) {
              const qty = item.qty || item.quantity || 1;
              const price = item.price || 0;
              return `<div class="order-item">
                <span>${item.name} x${qty}</span>
                <span>${formatARS(price * qty)}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="order-total">Total: ${formatARS(order.total)}</div>
          ${shipping}
        </div>
      `;
      container.style.display = 'block';
      if (lookup) lookup.style.display = 'none';
      if (fallback) fallback.style.display = 'none';
    } catch (err) {
      console.error('Error cargando seguimiento:', err);
      showToast('', window.getFetchErrorMessage(err) || 'Error al cargar el pedido. Intentá nuevamente más tarde.', 'error');
      if (container) container.style.display = 'none';
      if (lookup) lookup.style.display = 'none';
      if (fallback) fallback.style.display = 'block';
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    if (orderId) {
      loadTracking(orderId);
      return;
    }

    const form = document.getElementById('trackingLookupForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('trackingOrderId');
        const id = input ? input.value.trim() : '';
        if (!id) return;
        loadTracking(id);
      });
    }
  });
})();
