(function() {
  initSiteHeader({ showBackButton: true });

  if (typeof initNavbarScroll === 'function') initNavbarScroll();
  if (typeof initMobileNavbar === 'function') initMobileNavbar();

  async function loadOrders(email) {
    const container = document.getElementById('ordersContainer');
    const lookup = document.getElementById('ordersLookup');
    if (!container) return;
    try {
      const raw = sessionStorage.getItem('ag_last_order');
      let accessToken = '';
      if (raw) {
        try { accessToken = JSON.parse(raw).orderToken || ''; } catch (e) { /* ignore */ }
      }
      const url = new URL(`${CONFIG.API.BASE}/api/orders`);
      url.searchParams.set('email', email);
      if (accessToken) url.searchParams.set('access_token', accessToken);
      const res = await window.fetchWithRetry(url.toString(), {}, 2, 1000);
      if (!res) throw new Error('Error al cargar pedidos');
      const orders = await res.json();
      currentOrderEmail = email;
      if (!orders.length) {
        container.innerHTML = '<div class="empty-orders"><h2>No tenés pedidos</h2><p>No encontramos pedidos asociados a ese email.</p><a href="../index.html#catalog" class="btn-primary" style="margin-top:1rem;">Ver catálogo</a></div>';
        container.style.display = 'block';
        if (lookup) lookup.style.display = 'none';
        startOrderPolling(email);
        return;
      }
      container.innerHTML = orders.map(order => {
        const statusClass = 'status-' + (order.status || 'pending');
        const items = (() => { try { return JSON.parse(order.items || '[]'); } catch (e) { return []; } })();
        return `
          <div class="order-card">
            <div class="order-header">
              <div>
                <span class="order-id">Pedido #${order.id}</span>
                <span class="order-date">${new Date(order.created_at).toLocaleDateString('es-AR')}</span>
              </div>
              <span class="order-status ${statusClass}">${order.status || 'pending'}</span>
            </div>
            <div class="order-items">
              ${items.map(item => `
                <div class="order-item">
                  <span>${item.name} x${item.qty || item.quantity || 1}</span>
                  <span>${formatARS((item.price || 0) * (item.quantity || item.qty || 1))}</span>
                </div>
              `).join('')}
            </div>
            <div class="order-total">Total: ${formatARS(order.total)}</div>
            <a class="btn btn-outline btn-sm" href="../pages/tracking.html?orderId=${order.id}" style="margin-top:0.75rem;display:inline-flex;">Ver Estado del Pedido</a>
          </div>
        `;
      }).join('');
      container.style.display = 'block';
      if (lookup) lookup.style.display = 'none';
      startOrderPolling(email);
    } catch (err) {
      showToast('', window.getFetchErrorMessage(err) || 'Error al cargar pedidos. Intentá nuevamente más tarde.', 'error');
      container.innerHTML = '<div class="empty-orders"><h2>Error al cargar pedidos</h2><p>Intentá nuevamente más tarde.</p></div>';
      container.style.display = 'block';
    }
  }

  function init() {
    const form = document.getElementById('orderLookupForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('orderEmail').value.trim();
        if (!email) return;
        loadOrders(email);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  let currentOrderEmail = '';
  function startOrderPolling(email) {
    currentOrderEmail = email;
    stopDataSync('user-orders');
    if (typeof initSSESync === 'function') initSSESync();
    startDataSync('user-orders', () => {
      if (currentOrderEmail && document.getElementById('ordersContainer')) {
        loadOrders(currentOrderEmail);
      }
    });
  }

  onSyncMessage('order_created', () => {
    if (currentOrderEmail && document.getElementById('ordersContainer')) {
      loadOrders(currentOrderEmail);
    }
  });

  onSyncMessage('order_status_updated', () => {
    if (currentOrderEmail && document.getElementById('ordersContainer')) {
      loadOrders(currentOrderEmail);
    }
  });

  onSyncMessage('hero_updated', () => {
    if (typeof loadHeroCards === 'function') loadHeroCards();
  });

  onSyncMessage('products_updated', () => {
    if (typeof fetchProducts === 'function') {
      fetchProducts().then(() => {
        if (typeof renderProducts === 'function') renderProducts(getProducts());
      });
    }
  });
})();
