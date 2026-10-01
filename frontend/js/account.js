(function () {
  'use strict';

  var TOKEN_KEY = 'accountToken';
  var PROFILE_KEY = 'accountProfile';

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* noop */ }
  }

  function profile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveProfile(data) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
  }

  function showAuthenticated(show) {
    var login = document.getElementById('accountLogin');
    var content = document.getElementById('accountContent');
    var dashboard = document.getElementById('accountDashboard');
    if (login) login.hidden = show;
    if (content) content.hidden = false;
    if (dashboard) dashboard.hidden = !show;
  }

  function loadProfile() {
    var data = profile();
    ['accountName', 'accountEmail', 'accountPhone', 'accountAddress'].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = data[id.replace('account', '').toLowerCase()] || '';
    });
  }

  function renderOrders(orders) {
    var container = document.getElementById('accountOrders');
    if (!container) return;
    container.innerHTML = '';
    if (!orders.length) {
      window.renderEmptyState({
        container: container,
        icon: '⌕',
        title: 'No hay pedidos',
        message: 'Cuando realices una compra, aparecerá en esta sección.',
        action: { label: 'Ver catálogo', href: '../index.html#catalog', className: 'btn btn-primary btn-sm' }
      });
      return;
    }
    orders.forEach(function (order) {
      var card = document.createElement('article');
      card.className = 'order-card';
      var header = document.createElement('div');
      header.className = 'order-header';
      var title = document.createElement('div');
      var id = document.createElement('strong');
      id.textContent = 'Pedido #' + order.id;
      var date = document.createElement('span');
      date.className = 'order-date';
      date.textContent = new Date(order.created_at).toLocaleDateString('es-AR');
      title.appendChild(id);
      title.appendChild(date);
      var status = document.createElement('span');
      status.className = 'order-status ' + (order.status || 'pending');
      status.textContent = order.status || 'pending';
      header.appendChild(title);
      header.appendChild(status);
      card.appendChild(header);
      var items = document.createElement('div');
      items.className = 'order-items';
      try {
        JSON.parse(order.items || '[]').forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'order-item';
          var name = document.createElement('span');
          name.textContent = (item.name || 'Producto') + ' x' + (item.qty || item.quantity || 1);
          var price = document.createElement('span');
          price.textContent = formatARS((item.price || 0) * (item.qty || item.quantity || 1));
          row.appendChild(name);
          row.appendChild(price);
          items.appendChild(row);
        });
      } catch (e) { /* noop */ }
      var total = document.createElement('div');
      total.className = 'order-total';
      total.textContent = 'Total: ' + formatARS(order.total);
      card.appendChild(items);
      card.appendChild(total);
      if (order.id) {
        var link = document.createElement('a');
        link.className = 'btn btn-outline btn-sm';
        link.href = 'tracking.html?orderId=' + encodeURIComponent(order.id);
        link.textContent = 'Ver seguimiento';
        card.appendChild(link);
      }
      container.appendChild(card);
    });
  }

  function loadOrders(email) {
    var container = document.getElementById('accountOrders');
    var loading = document.getElementById('accountOrdersLoading');
    if (!container || !email) return;
    if (loading) window.showLoading(loading, { label: 'Cargando pedidos...' });
    window.fetchWithRetry(CONFIG.API.BASE + '/api/orders?email=' + encodeURIComponent(email), {}, 2, 1000)
      .then(function (res) {
        if (!res || !res.ok) throw new Error('No se pudieron cargar los pedidos');
        return res.json();
      }).then(function (orders) {
        renderOrders(Array.isArray(orders) ? orders : []);
      }).catch(function (err) {
        window.showToast('!', err.message || 'Error al cargar pedidos', 'error');
      }).finally(function () {
        if (loading) window.hideLoading(loading);
      });
  }

  function switchTab(name) {
    document.querySelectorAll('[data-account-tab]').forEach(function (button) {
      var active = button.getAttribute('data-account-tab') === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-account-panel]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-account-panel') !== name;
    });
  }

  function init() {
    var loginForm = document.getElementById('accountLoginForm');
    var loginMessage = document.getElementById('accountLoginMessage');
    var logout = document.getElementById('accountLogout');
    var profileForm = document.getElementById('accountProfileForm');
    var ordersForm = document.getElementById('accountOrdersForm');
    var exportBtn = document.getElementById('accountExportBtn');
    var deleteBtn = document.getElementById('accountDeleteBtn');
    document.querySelectorAll('[data-account-tab]').forEach(function (button) {
      button.addEventListener('click', function () { switchTab(button.getAttribute('data-account-tab')); });
    });
    if (loginForm) {
      loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var username = document.getElementById('accountLoginUser').value.trim();
        var password = document.getElementById('accountLoginPassword').value;
        if (!username || !password) {
          if (loginMessage) loginMessage.textContent = 'Ingresá tus credenciales';
          return;
        }
        fetch(CONFIG.API.BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: username, password: password })
        }).then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');
            return data;
          });
        }).then(function (data) {
          setToken(data.token);
          saveProfile(Object.assign(profile(), { username: data.user, email: data.user }));
          loadProfile();
          showAuthenticated(true);
          if (loginMessage) loginMessage.textContent = '';
          window.showToast('✓', 'Sesión iniciada', 'success');
        }).catch(function (err) {
          if (loginMessage) loginMessage.textContent = err.message || 'No se pudo iniciar sesión';
        });
      });
    }
    if (logout) logout.addEventListener('click', function () {
      fetch(CONFIG.API.BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () { /* noop */ });
      setToken('');
      showAuthenticated(false);
      window.showToast('✓', 'Sesión cerrada', 'info');
    });
    if (profileForm) profileForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = profile();
      data.name = document.getElementById('accountName').value.trim();
      data.email = document.getElementById('accountEmail').value.trim();
      data.phone = document.getElementById('accountPhone').value.trim();
      data.address = document.getElementById('accountAddress').value.trim();
      saveProfile(data);
      window.showToast('✓', 'Perfil guardado localmente', 'success');
    });
    if (ordersForm) ordersForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = document.getElementById('accountOrderEmail').value.trim();
      if (email) loadOrders(email);
    });
    if (exportBtn) exportBtn.addEventListener('click', function () {
      if (!token()) return;
      fetch(CONFIG.API.BASE + '/api/auth/user/data-export', { headers: { Authorization: 'Bearer ' + token() } })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'iara-account-data.json';
          link.click();
          URL.revokeObjectURL(url);
          window.showToast('✓', 'Datos exportados', 'success');
        }).catch(function (err) { window.showToast('!', err.message || 'No se pudo exportar', 'error'); });
    });
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
      if (!token()) return;
      window.ConfirmDialog.ask({ title: 'Eliminar cuenta', message: 'Esta acción eliminará los datos asociados a tu cuenta.', confirmLabel: 'Eliminar', cancelLabel: 'Cancelar' }).then(function (confirmed) {
        if (!confirmed) return;
        fetch(CONFIG.API.BASE + '/api/auth/user/data-delete', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token() } })
          .then(function (res) { return res.json().then(function (data) { if (!res.ok) throw new Error(data.error || 'No se pudo eliminar'); }); })
          .then(function () { setToken(''); showAuthenticated(false); window.showToast('✓', 'Cuenta eliminada', 'success'); })
          .catch(function (err) { window.showToast('!', err.message || 'No se pudo eliminar la cuenta', 'error'); });
      });
    });
    if (token()) {
      loadProfile();
      showAuthenticated(true);
      var profileData = profile();
      if (profileData.email) loadOrders(profileData.email);
    } else {
      showAuthenticated(false);
    }
  }

  window.initAccount = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
