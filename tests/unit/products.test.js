/**
 * Tests unitarios para products.js (frontend)
 */

// Mock de CONFIG
global.CONFIG = {
  ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 }
};

// Mock DOM
document.createElement = (_tag) => ({
  className: '',
  innerHTML: '',
  textContent: '',
  style: {},
  getContext: () => ({}),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  classList: {
    add: () => {},
    contains: () => false,
    remove: () => {}
  }
});
document.getElementById = () => null;
document.querySelectorAll = () => [];

describe('products.js', () => {
  let productsModule;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    global.CONFIG = {
      API: { BASE: '' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 }
    };
    window.fetchWithRetry = async (url, opts = {}, _retries = 2, _backoffMs = 1000) => {
      const res = await global.fetch(url, opts);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      return res;
    };
    productsModule = require('../../frontend/js/products');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('fetchProducts hace GET a /api/products', async () => {
    const mockProducts = [
      { id: 1, name: 'Test', category: 'pulseras', price: 100 }
    ];
    const mockRes = { ok: true, json: async () => mockProducts };
    window.fetchWithRetry = jest.fn().mockResolvedValue(mockRes);

    await productsModule.fetchProducts();
    expect(window.fetchWithRetry).toHaveBeenCalledWith('/api/products', {}, 2, 1000);
  });

  test('fetchProducts maneja error de red', async () => {
    window.fetchWithRetry = jest.fn().mockRejectedValue(new Error('Network error'));

    await productsModule.fetchProducts();
    expect(productsModule.getProducts()).toEqual(productsModule.defaultProducts || [
      { id: 1, name: 'Pulsera Minimalista Rosa', category: 'pulseras', price: 450, description: 'Diseño minimalista con cuentas de cerámica en tonos rosa pastel', emoji: '📿', image: '' },
      { id: 2, name: 'Pulsera Menta Orgánica', category: 'pulseras', price: 520, description: 'Pulsera tejida con materiales ecológicos en tonos verdes', emoji: '📿', image: '' },
      { id: 3, name: 'Llavero Artesanal', category: 'accesorios', price: 250, description: 'Llavero tejido a mano con detalle floral', emoji: '💎', image: '' },
      { id: 4, name: 'Souvenir Gualeguay', category: 'souvenirs', price: 380, description: 'Imán decorativo con representación local', emoji: '🎁', image: '' },
      { id: 5, name: 'Pulsera Bohemia Multi', category: 'pulseras', price: 590, description: 'Pulsera con múltiples hilos y cuentas en tonos variados', emoji: '📿', image: '' },
      { id: 6, name: 'Collar Artesanal Corto', category: 'accesorios', price: 650, description: 'Collar corto con colgante hecho a mano', emoji: '💎', image: '' },
      { id: 7, name: 'Pack 3 Pulseras Surtidas', category: 'pulseras', price: 1200, description: 'Set de 3 pulseras con diferentes diseños', emoji: '📿', image: '' },
      { id: 8, name: 'Brazalete Tejido Premium', category: 'pulseras', price: 890, description: 'Brazalete ancho tejido con técnica tradicional', emoji: '📿', image: '' },
      { id: 9, name: 'Souvenir Taza Personalizada', category: 'souvenirs', price: 320, description: 'Taza de cerámica con diseño exclusivo de Gualeguay', emoji: '🎁', image: '' },
      { id: 10, name: 'Anillo Cerámica', category: 'accesorios', price: 280, description: 'Anillo ajustable hecho de cerámica cocida artesanalmente', emoji: '💎', image: '' },
      { id: 11, name: 'Pulsera Amistad Dual', category: 'pulseras', price: 480, description: 'Pulsera de amistad para compartir en tonos complementarios', emoji: '📿', image: '' },
      { id: 12, name: 'Marcapáginas Decorativo', category: 'souvenirs', price: 150, description: 'Marcapáginas hecho a mano con técnica mixta', emoji: '🎁', image: '' }
    ]);
  });

  test('formatARS formatea moneda argentina', () => {
    const configModule = require('../../frontend/js/config');
    const formatted = configModule.formatARS(1500);
    expect(formatted).toContain('1');
    expect(formatted).toContain('500');
  });

  test('getProductsByCategory filtra correctamente', () => {
    productsModule.setProducts([
      { id: 1, name: 'Pulsera', category: 'pulseras', price: 100 },
      { id: 2, name: 'Aretes', category: 'accesorios', price: 200 }
    ]);
    expect(productsModule.getProductsByCategory('pulseras').length).toBe(1);
    expect(productsModule.getProductsByCategory('accesorios').length).toBe(1);
    expect(productsModule.getProductsByCategory('all').length).toBe(2);
  });
});
