/* global loadDashboardStats */
/* ==================== ADMIN DASHBOARD PAGE ==================== */
(function() {
  if (window.location.protocol === 'file:') {
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;"><h2>⚠️ Panel de administración</h2><p>Este panel debe abrirse desde el servidor, no desde el sistema de archivos.</p></div>';
  }

  function init() {
    if (window.adminSidebar && typeof window.adminSidebar.init === 'function') {
      window.adminSidebar.init({
        onLogout: function () {
          if (typeof doLogout === 'function') doLogout();
        }
      });
    }

    if (typeof initAdminDashboard === 'function') initAdminDashboard();
    if (typeof initContentEditor === 'function') initContentEditor();
    if (typeof initProductManager === 'function') initProductManager();
    if (typeof initCategoryManager === 'function') initCategoryManager();
    if (typeof initSalesPanel === 'function') initSalesPanel();
    if (typeof initOrdersPanel === 'function') initOrdersPanel();
    if (typeof initPaymentsPanel === 'function') initPaymentsPanel();
    if (typeof loadDashboardStats === 'function') loadDashboardStats();

    var nav = document.getElementById('adminNav');
    if (nav) {
      nav.addEventListener('click', function (e) {
        if (!e.target.closest('a[data-section]')) return;
        if (window.adminSidebar && typeof window.adminSidebar.isDrawerOpen === 'function' && window.adminSidebar.isDrawerOpen()) {
          window.adminSidebar.closeDrawer(true);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.querySelectorAll('[data-event="change"][data-action="loadSalesSummary"]').forEach(function(el) {
    el.addEventListener('change', function() {
      if (typeof loadSalesSummary === 'function') loadSalesSummary();
    });
  });
})();
