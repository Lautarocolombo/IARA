/* ==================== ADMIN DASHBOARD.JS ==================== */
/* Controlador principal: auth gate, navegación de secciones, header */

(function () {
  'use strict';

  var SECTION_MAP = {
    content: { title: 'Contenido del sitio', breadcrumb: 'Editar textos visibles del frontend' },
    products: { title: 'Productos', breadcrumb: 'Crear, editar y gestionar productos' },
    categories: { title: 'Categorías', breadcrumb: 'Gestionar categorías de productos' },
    sales: { title: 'Ganancias', breadcrumb: 'Reportes de ventas e ingresos' },
    payments: { title: 'Medio de pago', breadcrumb: 'Configuración de alias y gestión de comprobantes' },
    orders: { title: 'Pedidos Individuales', breadcrumb: 'Detalle y verificación de pagos por pedido' }
  };

  var AUTH_CHECKED_KEY = 'ag_admin_token';

  function isTokenPresent() {
    var token = localStorage.getItem(AUTH_CHECKED_KEY);
    return !!(token && token.length > 0);
  }

  async function checkAuth() {
    if (!isTokenPresent()) {
      window.location.href = '../pages/admin.html';
      return false;
    }
    try {
      var res = await window.adminFetch('/api/admin/products?limit=1', { method: 'GET' });
      if (!res || !res.ok) {
        localStorage.removeItem(AUTH_CHECKED_KEY);
        window.location.href = '../pages/admin.html';
        return false;
      }
      var data = await res.json();
      if (window.adminUserNameEl) {
        window.adminUserNameEl.textContent = data.user || '';
      }
      return true;
    } catch (err) {
      console.error('[Dashboard] Error verificando auth:', err);
      return true;
    }
  }

  function setupNavigation() {
    var navLinks = document.querySelectorAll('#adminNav a[data-section]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var section = link.getAttribute('data-section');
        switchSection(section);
      });
    });
  }

  function switchSection(section) {
    var sections = document.querySelectorAll('.admin-section-active, .admin-section-inactive');
    sections.forEach(function (el) {
      el.classList.remove('admin-section-active');
      el.classList.add('admin-section-inactive');
    });

    var targetSection = document.getElementById('section-' + section);
    if (targetSection) {
      targetSection.classList.remove('admin-section-inactive');
      targetSection.classList.add('admin-section-active');
    }

    var navLinks = document.querySelectorAll('#adminNav a');
    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('data-section') === section) {
        link.classList.add('active');
      }
    });

    var info = SECTION_MAP[section] || {};
    var titleEl = document.getElementById('headerTitle');
    var breadcrumbEl = document.getElementById('headerBreadcrumb');
    if (titleEl) titleEl.textContent = info.title || '';
    if (breadcrumbEl) breadcrumbEl.textContent = info.breadcrumb || '';

    var saveAllBtnText = document.getElementById('saveAllBtnText');
    if (saveAllBtnText) {
      if (section === 'sales') {
        saveAllBtnText.textContent = 'Actualizar datos';
      } else {
        saveAllBtnText.textContent = 'Guardar en Nube';
      }
    }

    if (typeof window.onDashboardSectionChange === 'function') {
      window.onDashboardSectionChange(section);
    }

    if (typeof window.updateUnsavedUI === 'function') {
      window.updateUnsavedUI();
    }
  }

  function initAdminDashboard() {
    setupNavigation();

    if (isTokenPresent()) {
      checkAuth();
    } else {
      window.location.href = '../pages/admin.html';
    }
  }

  window.initAdminDashboard = initAdminDashboard;
  window.switchSection = switchSection;

  window.addEventListener('load', function () {
    if (typeof initRevealAnimation === 'function') initRevealAnimation();
  });
})();
