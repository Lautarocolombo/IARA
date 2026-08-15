/**
 * Tests unitarios para header.js
 */

// Mock de CONFIG
global.CONFIG = {
  CART: {
    STORAGE_KEY: 'ag_cart',
    SHIPPING_COST: 200,
    SHIPPING_THRESHOLD: 2000,
    FREE_SHIPPING_TEXT: 'Envío Gratis'
  },
  API: { BASE: '' },
  ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 }
};

describe('header.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.body.innerHTML = '<div class="skip-link"></div>';
    delete window.__siteHeaderInitialized;
    window.__skipHeaderAutoInit = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete window.__skipHeaderAutoInit;
  });

  test('initSiteHeader crea navbar con id navbar', () => {
    document.body.innerHTML = '<div class="skip-link"></div>';
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const navbar = document.getElementById('navbar');
    expect(navbar).not.toBeNull();
    expect(navbar.className).toBe('navbar');
  });

  test('initSiteHeader remueve navbar existente', () => {
    const existingNav = document.createElement('nav');
    existingNav.id = 'navbar';
    existingNav.className = 'old-navbar';
    document.body.appendChild(existingNav);

    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });

    const navbar = document.getElementById('navbar');
    expect(navbar).not.toBeNull();
    expect(navbar.className).toBe('navbar');
  });

  test('initSiteHeader agrega enlace al catálogo', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const nav = document.getElementById('navbar');
    expect(nav.innerHTML).toContain('href="#catalog"');
    expect(nav.innerHTML).toContain('Catálogo');
  });

  test('initSiteHeader agrega enlace a inicio', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const nav = document.getElementById('navbar');
    expect(nav.innerHTML).toContain('href="#home"');
    expect(nav.innerHTML).toContain('Inicio');
  });

  test('initSiteHeader agrega botón de tema', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const themeToggle = document.getElementById('themeToggle');
    expect(themeToggle).not.toBeNull();
    expect(themeToggle.title).toBe('Cambiar tema');
  });

  test('initSiteHeader agrega botón de wishlist', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const wishlistToggle = document.getElementById('wishlistToggle');
    expect(wishlistToggle).not.toBeNull();
    expect(wishlistToggle.getAttribute('aria-label')).toBe('Favoritos');
  });

  test('initSiteHeader agrega botón de carrito', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const cartBtn = document.querySelector('.pill-btn--cart');
    expect(cartBtn).not.toBeNull();
    expect(cartBtn.getAttribute('aria-label')).toBe('Carrito de compras');
  });

  test('initSiteHeader agrega badge del carrito', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const cartCount = document.getElementById('cartCount');
    expect(cartCount).not.toBeNull();
    expect(cartCount.textContent).toBe('0');
  });

  test('initSiteHeader agrega badge de wishlist', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const wishlistCount = document.getElementById('wishlistCount');
    expect(wishlistCount).not.toBeNull();
    expect(wishlistCount.textContent).toBe('0');
  });

  test('initSiteHeader agrega botón de admin', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const adminBtn = document.querySelector('.pill-btn--mascot');
    expect(adminBtn).not.toBeNull();
    expect(adminBtn.title).toBe('Panel de Administración');
  });

  test('initSiteHeader con showBackButton true agrega botón de volver', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: true });
    const navBack = document.querySelector('.nav-back');
    expect(navBack).not.toBeNull();
    expect(navBack.textContent).toContain('Volver al inicio');
  });

  test('initSiteHeader con showBackButton true agrega enlace a pedidos', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: true });
    const quickLink = document.querySelector('.nav-quick-link');
    expect(quickLink).not.toBeNull();
    expect(quickLink.textContent).toContain('Mis pedidos');
  });

  test('initSiteHeader con showBackButton true agrega enlace a favoritos', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: true });
    const nav = document.getElementById('navbar');
    expect(nav.innerHTML).toContain('Favoritos');
  });

  test('initSiteHeader con showBackButton false agrega menú de navegación', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const navbarMenu = document.getElementById('navbarMenu');
    expect(navbarMenu).not.toBeNull();
    expect(navbarMenu.innerHTML).toContain('Sobre Nosotros');
  });

  test('initSiteHeader con showBackButton false agrega botón toggle', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const toggle = document.getElementById('navbarToggle');
    expect(toggle).not.toBeNull();
  });

  test('initSiteHeader inserta navbar antes del skip-link', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false });
    const skipLink = document.querySelector('.skip-link');
    const navbar = document.getElementById('navbar');
    expect(skipLink.previousElementSibling).toBe(navbar);
  });

  test('initSiteHeader usa wishlistHref personalizado', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false, wishlistHref: 'custom-wishlist.html' });
    const wishlistLink = document.getElementById('wishlistToggle');
    expect(wishlistLink.href).toContain('custom-wishlist.html');
  });

  test('initSiteHeader usa adminHref personalizado', () => {
    require('../../frontend/js/header');
    window.initSiteHeader({ showBackButton: false, adminHref: 'custom-admin.html' });
    const adminLink = document.querySelector('.pill-btn--mascot');
    expect(adminLink.href).toContain('custom-admin.html');
  });

  test('autoInitSiteHeader no se ejecuta dos veces', () => {
    window.__skipHeaderAutoInit = true;
    require('../../frontend/js/header');
    window.__siteHeaderInitialized = false;
    window.autoInitSiteHeader();
    expect(window.__siteHeaderInitialized).toBe(true);
  });

  test('autoInitSiteHeader detecta página de inicio', () => {
    window.location.pathname = '/';
    window.__skipHeaderAutoInit = true;
    require('../../frontend/js/header');
    window.__siteHeaderInitialized = false;
    const spy = jest.spyOn(window, 'initSiteHeader').mockImplementation(() => {});
    window.autoInitSiteHeader();
    expect(spy).toHaveBeenCalledWith({ showBackButton: false });
    spy.mockRestore();
  });

  test('autoInitSiteHeader detecta página de subdirectorio', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/pages/cart.html' },
      writable: true,
      configurable: true
    });
    window.__skipHeaderAutoInit = true;
    require('../../frontend/js/header');
    window.__siteHeaderInitialized = false;
    const spy = jest.spyOn(window, 'initSiteHeader').mockImplementation(() => {});
    window.autoInitSiteHeader();
    expect(spy).toHaveBeenCalledWith({ showBackButton: true });
    spy.mockRestore();
  });
});
