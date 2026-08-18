/**
 * Tests unitarios para products.js (frontend)
 */

describe('products.js', () => {
  let productsModule;
  let originalGetElementById;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    global.CONFIG = {
      API: { BASE: '' },
      CONTACT: { WHATSAPP: '1234567890' },
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
    originalGetElementById = document.getElementById;
    productsModule = require('../../frontend/js/products');
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.getElementById = originalGetElementById;
    document.body.innerHTML = '';
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
    expect(productsModule.getProducts()).toEqual(productsModule.defaultProducts || []);
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

  test('escapeHtml escapa caracteres especiales', () => {
    const uiModule = require('../../frontend/js/ui');
    expect(uiModule.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(uiModule.escapeHtml('a & b')).toBe('a &amp; b');
    expect(uiModule.escapeHtml('"hola"')).toBe('&quot;hola&quot;');
    expect(uiModule.escapeHtml('it\'s')).toBe('it&#39;s');
    expect(uiModule.escapeHtml('')).toBe('');
    expect(uiModule.escapeHtml(null)).toBe('');
  });

  test('getFeaturedProducts retorna hasta 4 productos destacados', () => {
    productsModule.setProducts([
      { id: 1, featured: true },
      { id: 2, featured: true },
      { id: 3, featured: true },
      { id: 4, featured: true },
      { id: 5, featured: true }
    ]);
    expect(productsModule.getFeaturedProducts().length).toBe(4);
  });

  test('renderProducts renderiza productos en el grid', () => {
    const grid = document.createElement('div');
    grid.id = 'productsGrid';
    document.body.appendChild(grid);
    document.getElementById = (id) => id === 'productsGrid' ? grid : null;

    productsModule.setProducts([
      { id: 1, name: 'Pulsera', category: 'pulseras', price: 100, description: 'Desc', emoji: '📿', image: '', featured: false, badge: '', stock: 10 }
    ]);
    window.getProductImageUrl = jest.fn().mockReturnValue('');
    window.renderProductImage = jest.fn().mockReturnValue('<img>');
    window.isInWishlist = jest.fn().mockReturnValue(false);
    window.revealObserver = { observe: jest.fn() };
    window.formatARS = (n) => `$${n}`;

    productsModule.renderProducts(productsModule.getProducts());
    expect(grid.innerHTML).toContain('Pulsera');
    expect(grid.innerHTML).toContain('pulseras');
  });

  test('renderProducts muestra estado vacío cuando no hay productos', () => {
    const grid = document.createElement('div');
    grid.id = 'productsGrid';
    document.body.appendChild(grid);
    document.getElementById = (id) => id === 'productsGrid' ? grid : null;

    productsModule.renderProducts([]);
    expect(grid.innerHTML).toContain('No se encontraron productos');
  });

  test('setProducts actualiza el estado interno', () => {
    const newProducts = [{ id: 99, name: 'Nuevo', category: 'test', price: 1 }];
    productsModule.setProducts(newProducts);
    expect(productsModule.getProducts()).toEqual(newProducts);
  });
});
