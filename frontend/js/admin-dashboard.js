/* ==================== ADMIN DASHBOARD.JS ==================== */
/* Controlador principal: auth gate, navegación de secciones, header */

(function () {
  'use strict';

  var SECTION_MAP = {
    content:    { title: 'Contenido del sitio',  breadcrumb: 'Editar textos visibles del frontend' },
    products:   { title: 'Productos',          breadcrumb: 'Crear, editar y gestionar productos' },
    categories: { title: 'Categorías',         breadcrumb: 'Gestionar categorías del catálogo' },
    sales:      { title: 'Ganancias',          breadcrumb: 'Reportes de ventas e ingresos' },
    payments:   { title: 'Medio de Pago',       breadcrumb: 'Configurar alias y método de pago' },
    orders:     { title: 'Pedidos',             breadcrumb: 'Gestionar pedidos individuales' }
  };

  var AUTH_KEY = 'ag_admin_token';

  function isTokenPresent() {
    var token = localStorage.getItem(AUTH_KEY);
    return !!(token && token.length > 0);
  }

  function redirectToLogin() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '../pages/admin.html';
  }

  async function checkAuth() {
    if (!isTokenPresent()) {
      redirectToLogin();
      return false;
    }
    try {
      var res = await window.adminFetch('/api/admin/site-texts', { method: 'GET' });
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

    var navLinks = document.querySelectorAll('#adminNav a');
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-section') === section);
    });

    var info = SECTION_MAP[section] || {};
    var titleEl = document.getElementById('headerTitle');
    var breadcrumbEl = document.getElementById('headerBreadcrumb');
    if (titleEl) titleEl.textContent = info.title || '';
    if (breadcrumbEl) breadcrumbEl.textContent = info.breadcrumb || '';

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
      checkAuth().then(function (ok) {
        if (ok) {
          var tokenEl = document.getElementById('adminUserName');
          if (tokenEl) tokenEl.textContent = 'Iara';
        }
      });
    } else {
      redirectToLogin();
    }
  }

  window.initAdminDashboard = initAdminDashboard;
  window.switchSection = switchSection;
  window.isTokenPresent = isTokenPresent;

  window.addEventListener('load', function () {
    if (typeof initRevealAnimation === 'function') initRevealAnimation();
  });
})();
