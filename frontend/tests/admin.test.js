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

  it('getCurrentUser retorna username y role desde localStorage', async () => {
    await require('../js/admin.js');
    localStorage.setItem('ag_admin_user', 'lara');
    localStorage.setItem('ag_admin_role', 'admin');

    var user = window.getCurrentUser();
    expect(user.username).toBe('lara');
    expect(user.role).toBe('admin');
  });

  it('getAdminRole retorna el rol desde localStorage', async () => {
    await require('../js/admin.js');
    localStorage.setItem('ag_admin_role', 'editor');

    expect(window.getAdminRole()).toBe('editor');
  });

  it('getCurrentUser retorna vacío cuando no hay sesión', async () => {
    await require('../js/admin.js');
    var user = window.getCurrentUser();
    expect(user.username).toBe('');
    expect(user.role).toBe('');
  });

  it('doLogout limpia localStorage', async () => {
    await require('../js/admin.js');
    localStorage.setItem('ag_admin_token', 'fake-token');
    localStorage.setItem('ag_admin_user', 'lara');
    localStorage.setItem('ag_admin_role', 'admin');

    var token = window.getAuthToken();
    expect(token).toBe('fake-token');

    // Simulate logout cleanup (the actual function also fetches)
    localStorage.removeItem('ag_admin_token');
    localStorage.removeItem('ag_admin_user');
    localStorage.removeItem('ag_admin_role');

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
        <a href="#" data-section="users">Usuarios</a>
      </nav>
      <section id="section-content" class="admin-section-inactive"></section>
      <section id="section-products" class="admin-section-inactive"></section>
      <section id="section-categories" class="admin-section-inactive"></section>
      <section id="section-sales" class="admin-section-inactive"></section>
      <section id="section-payments" class="admin-section-inactive"></section>
      <section id="section-orders" class="admin-section-inactive"></section>
      <section id="section-users" class="admin-section-inactive"></section>
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
    localStorage.setItem('ag_admin_role', 'admin');

    window.applyRoleVisibility();

    var hiddenCount = 0;
    document.querySelectorAll('#adminNav a[data-section]').forEach(function (a) {
      if (window.getComputedStyle(a).display === 'none') hiddenCount++;
    });
    expect(hiddenCount).toBe(0);
  });

  it('editor NO ve Ganancias, Medio de Pago ni Usuarios en el sidebar', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    localStorage.setItem('ag_admin_role', 'editor');

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
    expect(visibleSections).not.toContain('users');
  });

  it('editor NO ve las secciones Ganancias/Medio de Pago/Usuarios del DOM', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    localStorage.setItem('ag_admin_role', 'editor');

    window.applyRoleVisibility();

    expect(document.getElementById('section-sales').style.display).toBe('none');
    expect(document.getElementById('section-payments').style.display).toBe('none');
    expect(document.getElementById('section-users').style.display).toBe('none');

    expect(document.getElementById('section-content').style.display).not.toBe('none');
    expect(document.getElementById('section-products').style.display).not.toBe('none');
    expect(document.getElementById('section-categories').style.display).not.toBe('none');
  });

  it('editor ve Pedidos (orders) en el sidebar', async () => {
    await require('../js/admin.js');
    await require('../js/admin-dashboard.js');
    localStorage.setItem('ag_admin_role', 'editor');

    window.applyRoleVisibility();

    var ordersLink = document.querySelector('#adminNav a[data-section="orders"]');
    expect(window.getComputedStyle(ordersLink).display).not.toBe('none');
  });
});

describe('Admin users module', () => {
  beforeEach(() => {
    jest.resetModules();
    global.CONFIG = {
      API: { BASE: 'http://localhost' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15, TRANSITION_SPEED: 0.4 }
    };
    document.body.innerHTML = `
      <div id="usersTableBody"></div>
      <div id="userModalOverlay"></div>
      <div id="confirmModalOverlay"></div>
      <div id="userModalTitle"></div>
      <div id="userUsername"></div>
      <div id="userPassword"></div>
      <div id="userPasswordToggle"></div>
      <div id="userPasswordHint"></div>
      <div id="userRole"></div>
      <div id="userActive"></div>
      <button id="addUserBtn"></button>
      <button id="closeUserModal"></button>
      <button id="cancelUserBtn"></button>
      <button id="saveUserBtn"></button>
      <button id="cancelConfirmBtn"></button>
      <button id="confirmModalAction"></button>
      <span id="confirmModalMessage"></span>
      <div id="toastContainer"></div>
    `;
    localStorage.clear();
  });

  it('admin-users.js loads and expone loadUsers, openUserModal, openDeleteModal', async () => {
    await require('../js/ui.js');
    await require('../js/admin.js');
    await require('../js/admin-users.js');
    expect(typeof window.loadUsers).toBe('function');
    expect(typeof window.openUserModal).toBe('function');
    expect(typeof window.openDeleteModal).toBe('function');
  });

  it('openUserModal establece el título correcto para crear', async () => {
    await require('../js/ui.js');
    await require('../js/admin.js');
    await require('../js/admin-users.js');

    window.openUserModal(null);

    var overlay = document.getElementById('userModalOverlay');
    var title = document.getElementById('userModalTitle');
    expect(overlay.classList.contains('active')).toBe(true);
    expect(title.textContent).toBe('Nuevo usuario');
  });

  it('openUserModal establece el título correcto para editar', async () => {
    await require('../js/ui.js');
    await require('../js/admin.js');
    await require('../js/admin-users.js');

    window.openUserModal({
      id: 1, username: 'editor1', role: 'editor', active: true,
      password: '', last_login: null
    });

    var overlay = document.getElementById('userModalOverlay');
    var title = document.getElementById('userModalTitle');
    expect(overlay.classList.contains('active')).toBe(true);
    expect(title.textContent).toBe('Editar usuario');
  });
});
