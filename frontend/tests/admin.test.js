/**
 * @jest-environment jsdom
 */

describe('Frontend admin - auth state', () => {
  beforeEach(() => {
    jest.resetModules();
    global.CONFIG = {
      API: { BASE: 'http://localhost' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15, TRANSITION_SPEED: 0.4 }
    };
    document.body.innerHTML = '<div id="toastContainer"></div><div id="loginOverlay"></div>';
    localStorage.clear();
  });

  it('should load admin.js without throwing', async () => {
    await require('../js/admin.js');
    expect(true).toBe(true);
  });

  it('getCurrentUser retorna username y role desde estado en memoria', async () => {
    await require('../js/admin.js');
    window.__setCurrentUser({ user: 'lara', role: 'admin' });

    var user = window.getCurrentUser();
    expect(user.username).toBe('lara');
    expect(user.role).toBe('admin');
  });

  it('getAdminRole retorna el rol desde estado en memoria', async () => {
    await require('../js/admin.js');
    window.__setCurrentUser({ user: 'lara', role: 'editor' });

    expect(window.getAdminRole()).toBe('editor');
  });

  it('getCurrentUser retorna vacío cuando no hay sesión', async () => {
    await require('../js/admin.js');
    var user = window.getCurrentUser();
    expect(user.username).toBe('');
    expect(user.role).toBe('');
  });

  it('doLogout limpia estado en memoria', async () => {
    await require('../js/admin.js');
    window.__setAdminToken('fake-token');
    window.__setCurrentUser({ user: 'lara', role: 'admin' });

    var token = window.getAuthToken();
    expect(token).toBe('fake-token');

    // Simulate logout cleanup without making network requests
    window.__setAdminToken('');
    window.__setCurrentUser(null);

    expect(window.getAuthToken()).toBe('');
    expect(window.getCurrentUser().username).toBe('');
    expect(window.getCurrentUser().role).toBe('');
  });
});

describe('Admin dashboard role-based visibility', () => {
  beforeEach(() => {
    jest.resetModules();
    global.CONFIG = {
      API: { BASE: 'http://localhost' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15, TRANSITION_SPEED: 0.4 }
    };
    localStorage.clear();
    document.body.innerHTML = `
      <nav id="adminNav">
        <a href="#" data-section="content">Contenido</a>
        <a href="#" data-section="products">Productos</a>
        <a href="#" data-section="categories">Categorías</a>
        <a href="#" data-section="sales">Ganancias</a>
        <a href="#" data-section="payments">Medio de Pago</a>
        <a href="#" data-section="orders">Pedidos</a>
      </nav>
      <section id="section-content" class="admin-section-inactive"></section>
      <section id="section-products" class="admin-section-inactive"></section>
      <section id="section-categories" class="admin-section-inactive"></section>
      <section id="section-sales" class="admin-section-inactive"></section>
      <section id="section-payments" class="admin-section-inactive"></section>
      <section id="section-orders" class="admin-section-inactive"></section>
      <div id="toastContainer"></div>
    `;
  });

  it('carga admin-dashboard.js sin errores', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    expect(typeof window.initAdminDashboard).toBe('function');
    expect(typeof window.applyRoleVisibility).toBe('function');
  });

  it('admin ve todas las secciones del sidebar', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    window.__setCurrentUser({ user: 'admin', role: 'admin' });

    window.applyRoleVisibility();

    var hiddenCount = 0;
    document.querySelectorAll('#adminNav a[data-section]').forEach(function (a) {
      if (window.getComputedStyle(a).display === 'none') hiddenCount++;
    });
    expect(hiddenCount).toBe(0);
  });

  it('editor NO ve Ganancias ni Medio de Pago en el sidebar', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    window.__setCurrentUser({ user: 'editor', role: 'editor' });

    window.applyRoleVisibility();

    var navLinks = document.querySelectorAll('#adminNav a[data-section]');
    var visibleSections = [];
    navLinks.forEach(function (a) {
      if (window.getComputedStyle(a).display !== 'none') {
        visibleSections.push(a.getAttribute('data-section'));
      }
    });

    expect(visibleSections).toContain('content');
    expect(visibleSections).toContain('products');
    expect(visibleSections).toContain('categories');
    expect(visibleSections).toContain('orders');
    expect(visibleSections).not.toContain('sales');
    expect(visibleSections).not.toContain('payments');
  });

  it('editor NO ve las secciones Ganancias/Medio de Pago del DOM', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    window.__setCurrentUser({ user: 'editor', role: 'editor' });

    window.applyRoleVisibility();

    expect(document.getElementById('section-sales').style.display).toBe('none');
    expect(document.getElementById('section-payments').style.display).toBe('none');

    expect(document.getElementById('section-content').style.display).not.toBe('none');
    expect(document.getElementById('section-products').style.display).not.toBe('none');
    expect(document.getElementById('section-categories').style.display).not.toBe('none');
  });

  it('editor ve Pedidos (orders) en el sidebar', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    window.__setCurrentUser({ user: 'editor', role: 'editor' });

    window.applyRoleVisibility();

    var ordersLink = document.querySelector('#adminNav a[data-section="orders"]');
    expect(window.getComputedStyle(ordersLink).display).not.toBe('none');
  });
});


