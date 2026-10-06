/**
 * Regresión: los productos destacados deben guardarse y verse.
 *
 * Cubre los tres bugs que hacían que "agregar/quitar destacado" no pareciera
 * tener efecto:
 *   1. editProduct() no restauraba el checkbox prod_featured al editar.
 *   2. renderFeaturedProducts() escribía las cards en #productsGrid en vez de
 *      #featuredGrid, dejando la sección de destacados siempre vacía.
 *   3. No había forma directa de togglear el destacado desde la tabla.
 */

describe('featured products — regresión', () => {
  describe('renderFeaturedProducts', () => {
    let productsModule;
    let originalGetElementById;
    let featuredGrid;
    let productsGrid;

    beforeEach(() => {
      jest.resetModules();
      productsModule = require('../../frontend/js/products');

      featuredGrid = document.createElement('div');
      featuredGrid.id = 'featuredGrid';
      productsGrid = document.createElement('div');
      productsGrid.id = 'productsGrid';
      document.body.appendChild(featuredGrid);
      document.body.appendChild(productsGrid);

      originalGetElementById = document.getElementById.bind(document);
      document.getElementById = (id) => {
        if (id === 'featuredGrid') return featuredGrid;
        if (id === 'productsGrid') return productsGrid;
        return originalGetElementById(id);
      };

      require('../../frontend/js/safeImage');
      window.getProductImageUrl = jest.fn().mockReturnValue('');
      window.renderProductImage = jest.fn().mockReturnValue('<img>');
      window.buildProductImageLayers = jest.fn().mockReturnValue('<img>');
      window.buildWhatsAppLink = jest.fn().mockReturnValue('https://wa.me/123');
      window.isInWishlist = jest.fn().mockReturnValue(false);
      window.revealObserver = { observe: jest.fn() };
      window.formatARS = (n) => `$${n}`;
    });

    afterEach(() => {
      document.getElementById = originalGetElementById;
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    test('renderiza las cards en #featuredGrid y NO toca #productsGrid', () => {
      productsModule.setProducts([
        { id: 1, name: 'Destacada Uno', category: 'pulseras', price: 100, description: 'd', emoji: 'P', image: '', featured: true, badge: '', stock: 10 },
        { id: 2, name: 'Normal', category: 'pulseras', price: 200, description: 'd', emoji: 'P', image: '', featured: false, badge: '', stock: 10 }
      ]);

      productsModule.renderFeaturedProducts();

      expect(featuredGrid.innerHTML).toContain('Destacada Uno');
      expect(featuredGrid.innerHTML).not.toContain('Normal');
      expect(productsGrid.innerHTML).toBe('');
    });

    test('muestra estado vacío cuando ningún producto está destacado', () => {
      productsModule.setProducts([
        { id: 2, name: 'Normal', category: 'pulseras', price: 200, description: 'd', emoji: 'P', image: '', featured: false, badge: '', stock: 10 }
      ]);

      productsModule.renderFeaturedProducts();

      expect(featuredGrid.innerHTML).toContain('Aún no hay productos destacados');
      expect(productsGrid.innerHTML).toBe('');
    });

    test('renderProducts sigue escribiendo en #productsGrid', () => {
      productsModule.setProducts([
        { id: 2, name: 'Normal', category: 'pulseras', price: 200, description: 'd', emoji: 'P', image: '', featured: false, badge: '', stock: 10 }
      ]);

      productsModule.renderProducts(productsModule.getProducts());

      expect(productsGrid.innerHTML).toContain('Normal');
      expect(featuredGrid.innerHTML).toBe('');
    });
  });

  describe('admin-products editProduct', () => {
    let adminFetchMock;

    function mountModal() {
      document.body.innerHTML = [
        '<input type="checkbox" id="prod_active" />',
        '<input type="checkbox" id="prod_featured" />',
        '<input type="text" id="prod_name" />',
        '<input type="text" id="prod_category" />',
        '<input type="number" id="prod_price" />',
        '<textarea id="prod_description"></textarea>',
        '<input type="text" id="prod_emoji" />',
        '<input type="number" id="prod_stock" />',
        '<input type="text" id="prod_badge" />',
        '<input type="text" id="prod_sku" />',
        '<div id="prod_name_group"></div>',
        '<div id="prod_price_group"></div>',
        '<span id="prod_name_error"></span>',
        '<span id="prod_price_error"></span>',
        '<div id="productModalOverlay"></div>',
        '<div id="productImageGallery"></div>',
        '<div id="productExistingImagesSection"></div>',
        '<table><tbody id="productsTableBody"></tbody></table>'
      ].join('');
    }

    function mockProducts(products) {
      adminFetchMock = jest.fn(async (url) => {
        if (String(url).indexOf('/api/admin/products') !== -1) {
          return { ok: true, json: async () => ({ products }) };
        }
        return { ok: true, json: async () => ({ categories: [] }) };
      });
      window.adminFetch = adminFetchMock;
    }

    beforeEach(() => {
      jest.resetModules();
      mountModal();

      window.escapeHtml = (s) => String(s == null ? '' : s);
      window.escapeAttr = (s) => String(s == null ? '' : s);
      window.showToast = jest.fn();
      window.getProductImageUrl = jest.fn().mockReturnValue('');
      window.imgError = jest.fn();
      window.saveToCloud = jest.fn();
      window.showConfirmModal = jest.fn();

      mockProducts([
        { id: 1, name: 'Ya destacado', category: 'pulseras', price: 100, description: '', emoji: 'P', stock: 5, badge: '', sku: '', active: true, featured: true },
        { id: 2, name: 'Sin destacar', category: 'pulseras', price: 200, description: '', emoji: 'P', stock: 5, badge: '', sku: '', active: true, featured: false }
      ]);

      require('../../frontend/js/admin-products.js');
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    test('marca el checkbox cuando el producto ya estaba destacado', async () => {
      await window.reloadProducts();

      window.editProduct(1);

      expect(document.getElementById('prod_featured').checked).toBe(true);
    });

    test('deja el checkbox desmarcado cuando el producto no estaba destacado', async () => {
      await window.reloadProducts();

      window.editProduct(2);

      expect(document.getElementById('prod_featured').checked).toBe(false);
    });

    test('tolera featured=0 y active=1 de SQLite', async () => {
      mockProducts([
        { id: 3, name: 'SQLite', category: 'pulseras', price: 100, description: '', emoji: 'P', stock: 1, badge: '', sku: '', active: 1, featured: 0 }
      ]);
      await window.reloadProducts();

      window.editProduct(3);

      expect(document.getElementById('prod_featured').checked).toBe(false);
      expect(document.getElementById('prod_active').checked).toBe(true);
    });

    test('la tabla muestra el badge de destacado y el botón Destacar', async () => {
      await window.reloadProducts();

      var html = document.getElementById('productsTableBody').innerHTML;
      expect(html).toContain('badge-featured');
      expect(html).toContain('Destacar');
    });

    test('toggleProductFeatured hace PUT con featured=true', async () => {
      await window.reloadProducts();

      window.adminFetch = jest.fn(async () => ({ ok: true, json: async () => ({ id: 2 }) }));
      await window.toggleProductFeatured(2);

      var call = window.adminFetch.mock.calls.find(function (c) { return c[1] && c[1].method === 'PUT'; });
      expect(call).toBeTruthy();
      expect(call[0]).toBe('/api/admin/products/2');
      expect(call[1].body.get('featured')).toBe('true');
    });

    test('toggleProductFeatured quita el destacado con featured=false', async () => {
      await window.reloadProducts();

      window.adminFetch = jest.fn(async () => ({ ok: true, json: async () => ({ id: 1 }) }));
      await window.toggleProductFeatured(1);

      var call = window.adminFetch.mock.calls.find(function (c) { return c[1] && c[1].method === 'PUT'; });
      expect(call).toBeTruthy();
      expect(call[1].body.get('featured')).toBe('false');
    });
  });
});
