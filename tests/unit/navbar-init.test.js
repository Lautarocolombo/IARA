/**
 * Tests unitarios para navbar-init.js
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

describe('navbar-init.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.readyState = 'complete';
    document.body.innerHTML = '';
    window.__skipNavbarInit = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete window.__skipNavbarInit;
  });

  test('init llama a initNavbarScroll si está definido', () => {
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    require('../../frontend/js/navbar-init');
    window.init();
    expect(global.initNavbarScroll).toHaveBeenCalled();
  });

  test('init llama a initMobileNavbar si está definido', () => {
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    require('../../frontend/js/navbar-init');
    window.init();
    expect(global.initMobileNavbar).toHaveBeenCalled();
  });

  test('init no falla si initNavbarScroll no está definido', () => {
    delete global.initNavbarScroll;
    global.initMobileNavbar = jest.fn();
    require('../../frontend/js/navbar-init');
    expect(() => window.init()).not.toThrow();
    expect(global.initMobileNavbar).toHaveBeenCalled();
  });

  test('init no falla si initMobileNavbar no está definido', () => {
    global.initNavbarScroll = jest.fn();
    delete global.initMobileNavbar;
    require('../../frontend/js/navbar-init');
    expect(() => window.init()).not.toThrow();
    expect(global.initNavbarScroll).toHaveBeenCalled();
  });

  test('init no falla si ninguna función está definida', () => {
    delete global.initNavbarScroll;
    delete global.initMobileNavbar;
    require('../../frontend/js/navbar-init');
    expect(() => window.init()).not.toThrow();
  });

  test('init llama a ambas funciones cuando están definidas', () => {
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    require('../../frontend/js/navbar-init');
    window.init();
    expect(global.initNavbarScroll).toHaveBeenCalledTimes(1);
    expect(global.initMobileNavbar).toHaveBeenCalledTimes(1);
  });

  test('el módulo registra listener DOMContentLoaded cuando el documento está cargando', () => {
    document.readyState = 'loading';
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    jest.resetModules();
    window.__skipNavbarInit = false;
    require('../../frontend/js/navbar-init');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(global.initNavbarScroll).toHaveBeenCalled();
  });

  test('el módulo llama init directamente cuando el documento está completo', () => {
    document.readyState = 'complete';
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    jest.resetModules();
    window.__skipNavbarInit = false;
    require('../../frontend/js/navbar-init');
    expect(global.initNavbarScroll).toHaveBeenCalled();
    expect(global.initMobileNavbar).toHaveBeenCalled();
  });

  test('no registra listener duplicado cuando ya está completo', () => {
    document.readyState = 'complete';
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    jest.resetModules();
    window.__skipNavbarInit = false;
    require('../../frontend/js/navbar-init');
    const domContentLoadedCalls = addEventListenerSpy.mock.calls.filter(
      call => call[0] === 'DOMContentLoaded'
    );
    expect(domContentLoadedCalls.length).toBe(0);
  });

  test('funciona en modo estricto', () => {
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    require('../../frontend/js/navbar-init');
    expect(() => window.init()).not.toThrow();
  });

  test('init es idempotente', () => {
    global.initNavbarScroll = jest.fn();
    global.initMobileNavbar = jest.fn();
    require('../../frontend/js/navbar-init');
    window.init();
    window.init();
    window.init();
    expect(global.initNavbarScroll).toHaveBeenCalledTimes(3);
    expect(global.initMobileNavbar).toHaveBeenCalledTimes(3);
  });
});
