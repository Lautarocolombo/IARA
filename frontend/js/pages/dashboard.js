(function() {
  if (window.location.protocol === 'file:') {
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;"><h2>⚠️ Panel de administración</h2><p>Este panel debe abrirse desde el servidor, no desde el sistema de archivos.</p></div>';
  }

  function init() {
    if (typeof initAdminDashboard === 'function') initAdminDashboard();
    if (typeof initContentEditor === 'function') initContentEditor();
    if (typeof initProductManager === 'function') initProductManager();
    if (typeof initCategoryManager === 'function') initCategoryManager();
    if (typeof initSalesPanel === 'function') initSalesPanel();
    if (typeof initOrdersPanel === 'function') initOrdersPanel();
    if (typeof initPaymentsPanel === 'function') initPaymentsPanel();

    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggle = document.getElementById('sidebarToggle');

    function openSidebar() {
      sidebar.classList.add('open');
      overlay.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (toggle && sidebar) {
      toggle.addEventListener('click', function() {
        if (sidebar.classList.contains('admin-sidebar-open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    document.querySelectorAll('#adminNav a[data-section]').forEach(function(link) {
      link.addEventListener('click', function() {
        if (window.innerWidth <= 900) {
          closeSidebar();
        }
      });
    });

    document.getElementById('logoutBtn')?.addEventListener('click', function() {
      if (typeof doLogout === 'function') doLogout();
    });
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
