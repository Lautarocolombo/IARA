/* ==================== ADMIN DASHBOARD.JS ==================== */
/* Controlador principal: auth gate, navegación de secciones, header */

(function () {
  'use strict';

  var SECTION_ROLES = {
    content:    ['admin', 'editor', 'viewer'],
    carousel:   ['admin', 'editor', 'viewer'],
    products:   ['admin', 'editor', 'viewer'],
    categories: ['admin', 'editor', 'viewer'],
    testimonials: ['admin', 'editor', 'viewer'],
    sales:      ['admin'],
    payments:   ['admin'],
    orders:     ['admin', 'editor', 'viewer'],
    inventory:  ['admin', 'editor', 'viewer']
  };

  var SECTION_MAP = {
    content:    { title: 'Contenido del sitio',  breadcrumb: 'Editar textos visibles del frontend' },
    carousel:   { title: 'Editor de Carrusel',   breadcrumb: 'Gestionar imágenes del carrusel (5 slots)' },
    products:   { title: 'Productos',          breadcrumb: 'Crear, editar y gestionar productos' },
    categories: { title: 'Categorías',         breadcrumb: 'Gestionar categorías del catálogo' },
    testimonials: { title: 'Testimonios',      breadcrumb: 'Gestionar testimonios de clientes' },
    sales:      { title: 'Ganancias',          breadcrumb: 'Reportes de ventas e ingresos' },
    payments:   { title: 'Medio de Pago',       breadcrumb: 'Configurar alias y método de pago' },
    orders:     { title: 'Pedidos',             breadcrumb: 'Gestionar pedidos individuales' },
    inventory:  { title: 'Inventario',          breadcrumb: 'Gestionar stock y movimientos' }
  };

  function isTokenPresent() {
    var token = window.getAuthToken ? window.getAuthToken() : '';
    return !!(token && token.length > 0);
  }

  function redirectToLogin() {
    if (window.__setAdminToken) window.__setAdminToken('');
    var overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.remove('hidden');
    window.location.href = '../pages/admin.html';
  }

  async function checkAuth() {
    if (!isTokenPresent()) {
      var overlay = document.getElementById('loginOverlay');
      if (overlay) overlay.classList.remove('hidden');
      return false;
    }
    try {
      var res = await window.adminFetch('/api/v1/admin/site-texts', { method: 'GET' });
      if (!res || !res.ok) {
        redirectToLogin();
        return false;
      }
      return true;
    } catch (err) {
      var msg = (err && err.message) ? err.message : '';
      if (msg.indexOf('Sesión expirada') !== -1 || msg.indexOf('No autorizado') !== -1 || msg.indexOf('Acceso denegado') !== -1) {
        redirectToLogin();
        return false;
      }
      console.warn('[Dashboard] No se pudo verificar auth (network?), continuando...');
      return true;
    }
  }

  function setupNavigation() {
    var navLinks = document.querySelectorAll('#adminNav a[data-section]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        switchSection(link.getAttribute('data-section'));
      });
    });
    if (window.adminSidebar && typeof window.adminSidebar.setActiveSection === 'function') {
      window.adminSidebar.setActiveSection(
        document.querySelector('#adminNav a.is-active, #adminNav a.active')
          ? document.querySelector('#adminNav a.is-active, #adminNav a.active').getAttribute('data-section')
          : 'content'
      );
    }
  }

  function setupContentTabs() {
    var tabButtons = document.querySelectorAll('#contentTabsNav .content-tab');
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchContentTab(btn.getAttribute('data-content-tab'));
      });
    });

    var mobileSelect = document.getElementById('contentTabsMobileSelect');
    if (mobileSelect) {
      mobileSelect.addEventListener('change', function () {
        switchContentTab(mobileSelect.value);
      });
    }
  }

  function switchContentTab(tabId) {
    var panels = document.querySelectorAll('.content-tab-panel');
    panels.forEach(function (panel) {
      panel.classList.toggle('active', panel.getAttribute('data-content-tab') === tabId);
    });

    var tabButtons = document.querySelectorAll('#contentTabsNav .content-tab');
    tabButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-content-tab') === tabId);
    });

    var mobileSelect = document.getElementById('contentTabsMobileSelect');
    if (mobileSelect) {
      mobileSelect.value = tabId;
    }

    if (typeof window.updateUnsavedUI === 'function') {
      window.updateUnsavedUI();
    }

    var activePanel = document.querySelector('.content-tab-panel.active');
    if (activePanel) {
      activePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getCurrentRole() {
    return (window.getAdminRole && window.getAdminRole()) || 'admin';
  }

  function applyRoleVisibility() {
    var role = getCurrentRole();
    var adminNav = document.getElementById('adminNav');
    if (!adminNav) return;

    var navLinks = adminNav.querySelectorAll('a[data-section]');
    navLinks.forEach(function (link) {
      var section = link.getAttribute('data-section');
      var allowed = SECTION_ROLES[section];
      if (!allowed || allowed.indexOf(role) === -1) {
        link.style.display = 'none';
      }
    });

    Object.keys(SECTION_MAP).forEach(function (section) {
      var allowed = SECTION_ROLES[section];
      var el = document.getElementById('section-' + section);
      if ((allowed && allowed.indexOf(role) === -1) && el) {
        el.style.display = 'none';
      }
    });

    updateSectionGroupVisibility();
  }

  function updateSectionGroupVisibility() {
    var groups = document.querySelectorAll('#adminNav [data-section-group]');
    Array.prototype.forEach.call(groups, function (group) {
      var links = group.querySelectorAll('a[data-section]');
      var hidden = Array.prototype.filter.call(links, function (link) {
        return link.style.display === 'none';
      }).length;
      group.style.display = (links.length > 0 && hidden === links.length) ? 'none' : '';
    });
  }

  function switchSection(section) {
    var sections = document.querySelectorAll('.admin-section-active, .admin-section-inactive');
    sections.forEach(function (el) {
      el.classList.remove('admin-section-active');
      el.classList.add('admin-section-inactive');
    });

    var target = document.getElementById('section-' + section);
    if (target) {
      target.classList.remove('admin-section-inactive');
      target.classList.add('admin-section-active');
    }

    var scrollArea = document.scrollingElement || document.documentElement;
    if (scrollArea && scrollArea.scrollTop > 0) {
      scrollArea.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    var navLinks = document.querySelectorAll('#adminNav a');
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-section') === section);
    });

    if (window.adminSidebar && typeof window.adminSidebar.setActiveSection === 'function') {
      window.adminSidebar.setActiveSection(section);
    }

    var info = SECTION_MAP[section] || {};
    var titleEl = document.getElementById('headerTitle');
    var breadcrumbEl = document.getElementById('headerBreadcrumb');
    if (titleEl) titleEl.textContent = info.title || '';
    if (breadcrumbEl) breadcrumbEl.textContent = info.breadcrumb || '';

    if (typeof window.onDashboardSectionChange === 'function') {
      window.onDashboardSectionChange(section);
    }

    window.dispatchEvent(new CustomEvent('dashboard:section-changed', { detail: { section: section } }));

    if (typeof window.updateUnsavedUI === 'function') {
      window.updateUnsavedUI();
    }
  }

  function initAdminDashboard() {
    setupNavigation();
    setupContentTabs();
    applyRoleVisibility();

    checkAuth().then(function (ok) {
      if (ok) {
        var user = window.getCurrentUser ? window.getCurrentUser() : { username: 'Admin', role: 'admin' };
        var tokenEl = document.getElementById('adminUserName');
        if (tokenEl && user.username) tokenEl.textContent = user.username;
        if (window.adminSidebar && typeof window.adminSidebar.setUser === 'function') {
          window.adminSidebar.setUser(user);
        }
      }
    });
    updateLowStockIndicator();
    updatePendingOrdersBadge();
  }

  async function updateLowStockIndicator() {
    try {
      var res = await window.adminFetch('/api/v1/admin/products', { method: 'GET' });
      if (!res || !res.ok) return;
      var data = await res.json();
      var products = (data.products || []).filter(function (p) { return !p.deleted; });
      var lowStock = products.filter(function (p) { return Number(p.stock || 0) <= 5; });
      if (window.adminSidebar && typeof window.adminSidebar.setBadges === 'function') {
        window.adminSidebar.setBadges({ lowStock: lowStock.length });
      }
      var indicator = document.getElementById('lowStockIndicator');
      if (indicator) {
        if (lowStock.length > 0) {
          indicator.textContent = '⚠️ ' + lowStock.length + ' producto' + (lowStock.length > 1 ? 's' : '') + ' con stock bajo';
          indicator.style.display = 'inline-flex';
          indicator.onclick = function () {
            switchSection('products');
          };
        } else {
          indicator.style.display = 'none';
          indicator.onclick = null;
        }
      }
    } catch (err) {
      console.error('[Dashboard] Error cargando indicator de stock bajo:', err);
    }
  }

  async function updatePendingOrdersBadge() {
    try {
      var res = await window.adminFetch('/api/v1/admin/orders?limit=100', { method: 'GET' });
      if (!res || !res.ok) return;
      var data = await res.json();
      var pending = (data.orders || []).filter(function (o) { return o.status === 'pending'; }).length;
      if (window.adminSidebar && typeof window.adminSidebar.setBadges === 'function') {
        window.adminSidebar.setBadges({ ordersPending: pending });
      }
    } catch (err) {
      console.error('[Dashboard] Error cargando pedidos pendientes:', err);
    }
  }

  window.updateLowStockIndicator = updateLowStockIndicator;
  window.updatePendingOrdersBadge = updatePendingOrdersBadge;
  window.applyRoleVisibility = applyRoleVisibility;
  window.getCurrentRole = getCurrentRole;
  window.SECTION_ROLES = SECTION_ROLES;

  async function loadDashboardStats() {
    try {
      var res = await window.adminFetch('/api/v1/admin/dashboard/stats');
      if (!res || !res.sales) return;
      
      var stats = res;
      var s = stats.sales;
      
      // Actualizar cards de ventas
      updateStatCard('todaySales', s.today.total, s.today.count);
      updateStatCard('weekSales', s.week.total, s.week.count);
      updateStatCard('monthSales', s.month.total, s.month.count);
      
      // Actualizar alertas
      if (window.adminSidebar && typeof window.adminSidebar.setBadges === 'function') {
        window.adminSidebar.setBadges({
          ordersPending: stats.alerts?.pendingOrders || 0,
          lowStock: stats.alerts?.lowStockProducts || 0
        });
      }
      
      // Actualizar lista de stock bajo
      if (typeof updateLowStockIndicator === 'function') {
        // Forzar actualización con datos del dashboard
        if (stats.alerts?.lowStockList) {
          var indicator = document.getElementById('lowStockIndicator');
          if (indicator) {
            if (stats.alerts.lowStockList.length > 0) {
              indicator.textContent = '⚠️ ' + stats.alerts.lowStockList.length + ' producto' + (stats.alerts.lowStockList.length > 1 ? 's' : '') + ' con stock bajo';
              indicator.style.display = 'inline-flex';
            } else {
              indicator.style.display = 'none';
            }
          }
        }
      }
      
      // Actualizar pedidos recientes
      renderRecentOrders(stats.recentOrders || []);
      
      // Actualizar activity log
      renderActivityLog(stats.activityLog || []);
      
    } catch (err) {
      console.error('[Dashboard] Error cargando stats:', err);
    }
  }
  
  function updateStatCard(prefix, total, count) {
    var totalEl = document.getElementById(prefix + 'Total');
    var countEl = document.getElementById(prefix + 'Count');
    if (totalEl) totalEl.textContent = '$' + Number(total || 0).toLocaleString('es-AR');
    if (countEl) countEl.textContent = count + ' pedido' + (count !== 1 ? 's' : '');
  }
  
  function renderRecentOrders(orders) {
    var container = document.getElementById('recentOrdersList');
    if (!container) return;
    if (!orders.length) {
      container.innerHTML = '<p class="empty-state">No hay pedidos recientes</p>';
      return;
    }
    container.innerHTML = orders.map(function(o) {
      var customer = o.customerName || 'Cliente';
      var statusClass = 'status-' + (o.status || 'pending');
      return '<div class="recent-order-item">' +
        '<div class="recent-order-info">' +
          '<span class="recent-order-id">#' + o.id + '</span>' +
          '<span class="recent-order-customer">' + escapeHtml(customer) + '</span>' +
        '</div>' +
        '<div class="recent-order-meta">' +
          '<span class="recent-order-total">$' + Number(o.total || 0).toLocaleString('es-AR') + '</span>' +
          '<span class="recent-order-status ' + statusClass + '">' + (o.status || 'pending') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  
  function renderActivityLog(activities) {
    var container = document.getElementById('activityLogList');
    if (!container) return;
    if (!activities.length) {
      container.innerHTML = '<p class="empty-state">Sin actividad reciente</p>';
      return;
    }
    container.innerHTML = activities.map(function(a) {
      var time = a.createdAt ? new Date(a.createdAt).toLocaleString('es-AR') : '';
      var actionLabel = a.action || a.action_type || 'Acción';
      return '<div class="activity-item">' +
        '<div class="activity-meta">' +
          '<span class="activity-user">' + escapeHtml(a.username || 'Sistema') + '</span>' +
          '<span class="activity-time">' + time + '</span>' +
        '</div>' +
        '<div class="activity-details">' +
          '<span class="activity-action">' + escapeHtml(actionLabel) + '</span>' +
          (a.details ? '<span class="activity-entity">' + escapeHtml(a.details) + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }
  
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  window.initAdminDashboard = initAdminDashboard;
  window.switchSection = switchSection;
  window.isTokenPresent = isTokenPresent;
  window.loadDashboardStats = loadDashboardStats;

  window.addEventListener('load', function () {
    if (typeof initRevealAnimation === 'function') initRevealAnimation();
  });
})();

