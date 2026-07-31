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
    productsModule = require('../../public/js/products');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('fetchProducts hace GET a /api/products', async () => {
    const mockProducts = [
      { id: 1, name: 'Test', category: 'pulseras', price: 100 }
    ];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockProducts
    });

    await productsModule.fetchProducts();
    expect(global.fetch).toHaveBeenCalledWith('/api/products');
  });

  test('fetchProducts maneja error de red', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    await productsModule.fetchProducts();
    expect(Array.isArray(productsModule.getProducts())).toBe(true);
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
