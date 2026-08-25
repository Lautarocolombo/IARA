/**
 * Tests de integración para la página /favoritos (pages/wishlist.js).
 * Reproducen el escenario del browser: los scripts se cargan como módulos ES,
 * por lo que sólo los símbolos expuestos en `window` son compartibles entre ellos.
 */
const path = require('path');
const JS_DIR = path.join(__dirname, '..', '..', 'frontend', 'js');
const PAGES_DIR = path.join(JS_DIR, 'pages');

const WINDOW_GLOBALS = [
  'CONFIG', 'formatARS', 'getWhatsAppLink', 'getMailtoLink', 'getGoogleWriteReviewLink',
  'onSyncMessage', 'emitSync', 'startDataSync', 'stopDataSync', 'initSSESync', 'destroySSESync',
  'safeFetch', 'fetchWithRetry', 'getFetchErrorMessage', 'addToCartAndUpdate',
  'escapeHtml', 'unescapeHtml', 'sanitizeAboutText',
  'renderProductImage', 'getProductImageUrl', 'getPlaceholderDataUri',
  'getWishlist', 'saveWishlist', 'addToWishlist', 'removeFromWishlist', 'isInWishlist', 'updateWishlistBadge',
  'addToCart', 'updateCartBadge', 'updateCartDisplay', 'renderWishlist', 'revealObserver'
];

function resetGlobals() {
  WINDOW_GLOBALS.forEach(function (k) { delete window[k]; });
}

function setupDOM() {
  jest.resetModules();
  localStorage.clear();
  resetGlobals();
  document.body.innerHTML =
    '<span id="wishlistCount" class="">0</span>' +
    '<div id="wishlistToggle" aria-pressed="false"></div>' +
    '<div class="toast-container"></div>' +
    '<main id="content">' +
    '  <section class="catalog">' +
    '    <div id="emptyWishlist" class="empty-cart-container reveal" style="display:none;">' +
    '      <h2>No tenés favoritos aún</h2>' +
    '      <a href="../index.html#catalog" class="btn-primary">Ver catálogo</a>' +
    '    </div>' +
    '    <div id="wishlistContent">' +
    '      <div id="wishlistSkeleton" class="wishlist-skeleton reveal" style="display:none;"></div>' +
    '      <div id="wishlistError" class="empty-cart-container reveal" style="display:none;"></div>' +
    '      <div class="catalog-grid" id="wishlistGrid"></div>' +
    '    </div>' +
    '  </section>' +
    '</main>';
}

function loadSharedModules() {
  require(path.join(JS_DIR, 'config.js'));
  require(path.join(JS_DIR, 'ui.js'));
  require(path.join(JS_DIR, 'wishlist.js'));
  window.addToCart = jest.fn();
  window.renderProductImage = jest.fn(function () { return '<img class="product-card-img" />'; });
}

describe('Wishlist page (pages/wishlist.js)', () => {
  beforeEach(() => {
    jest.resetModules();
    setupDOM();
  });

  test('config.js expone CONFIG y formatARS en window (root-cause fix de los módulos)', () => {
    require(path.join(JS_DIR, 'config.js'));
    expect(typeof window.CONFIG).toBe('object');
    expect(window.CONFIG).not.toBeNull();
    expect(typeof window.formatARS).toBe('function');
    var formatted = window.formatARS(1500);
    expect(formatted).toEqual(expect.stringContaining('1'));
    expect(formatted).toEqual(expect.stringContaining('500'));
  });

  test('ui.js expone onSyncMessage, emitSync y startDataSync en window', () => {
    require(path.join(JS_DIR, 'ui.js'));
    expect(typeof window.onSyncMessage).toBe('function');
    expect(typeof window.emitSync).toBe('function');
    expect(typeof window.startDataSync).toBe('function');
    expect(typeof window.stopDataSync).toBe('function');
  });

  test('agregar desde el catálogo -> /favoritos muestra la card de producto (consistencia visual)', () => {
    loadSharedModules();

    // 1) "Agregar a favoritos desde el catálogo" (persiste en localStorage)
    window.addToWishlist({ id: 1, name: 'Pulsera de Plata', price: 1500, emoji: '📿', image: 'pulsera.jpg' });
    expect(window.getWishlist().length).toBe(1);

    // 2) Navegar a /favoritos -> la página renderiza las cards
    require(path.join(PAGES_DIR, 'wishlist.js'));

    var grid = document.getElementById('wishlistGrid');
    var html = grid.innerHTML;

    expect(html).toContain('Pulsera de Plata');                 // nombre del producto
    // Precio formateado coincide con formatARS (robusto a locale/ICU)
    var priceText = grid.querySelector('.product-price').textContent;
    expect(priceText).toBe(window.formatARS(1500));
    expect(html).toContain('product-card');                    // reutiliza el componente del catálogo
    expect(html).toContain('product-name');
    expect(html).toContain('product-price');
    expect(html).toContain('Ver producto');                    // botón para ir al detalle
    expect(html).toContain('remove-from-wishlist');            // corazón lleno para sacar
    expect(html).toContain('btn-add-cart');                    // agregar al carrito desde la card

    // Estado vacío oculto y contenido visible
    expect(document.getElementById('emptyWishlist').style.display).toBe('none');
    expect(document.getElementById('wishlistContent').style.display).toBe('block');

    // 3) El contador del corazón del header coincide con la cantidad real
    expect(document.getElementById('wishlistCount').textContent).toBe('1');
  });

  test('quitar un producto desde /favoritos actualiza la lista sin refrescar', () => {
    loadSharedModules();
    window.addToWishlist({ id: 7, name: 'Arete Azul', price: 850, emoji: '💎', image: '' });
    require(path.join(PAGES_DIR, 'wishlist.js'));

    var grid = document.getElementById('wishlistGrid');
    expect(grid.querySelectorAll('[data-action="remove-from-wishlist"]').length).toBe(1);

    // Click en el corazón lleno -> saca de la lista
    grid.querySelector('[data-action="remove-from-wishlist"]').click();

    expect(window.getWishlist().length).toBe(0);
    expect(grid.innerHTML).toBe('');
    expect(document.getElementById('emptyWishlist').style.display).toBe('block');
    expect(document.getElementById('wishlistContent').style.display).toBe('none');
    expect(document.getElementById('wishlistCount').textContent).toBe('0');
  });

  test('sin favoritos muestra el estado vacío con ilustración y CTA al catálogo', () => {
    loadSharedModules();

    require(path.join(PAGES_DIR, 'wishlist.js'));

    var empty = document.getElementById('emptyWishlist');
    expect(empty.style.display).toBe('block');
    expect(empty.innerHTML).toContain('Ver catálogo');
    expect(empty.querySelector('a.btn-primary')).toBeTruthy();
    expect(document.getElementById('wishlistContent').style.display).toBe('none');
    expect(document.getElementById('wishlistGrid').innerHTML).toBe('');
  });

  test('persistencia: recargar la página mantiene los favoritos (localStorage)', () => {
    loadSharedModules();

    // Primera carga: agregar + persistir en localStorage
    window.addToWishlist({ id: 3, name: 'Colgante Sol', price: 2200, emoji: '☀️', image: '' });
    expect(window.getWishlist().length).toBe(1);

    // "Refrescar": el navegador conserva localStorage, se vuelve a montar la página
    jest.resetModules();
    resetGlobals();
    document.body.innerHTML =
      '<span id="wishlistCount" class="">0</span>' +
      '<div id="wishlistToggle" aria-pressed="false"></div>' +
      '<div class="toast-container"></div>' +
      '<main id="content"><section class="catalog">' +
      '  <div id="emptyWishlist" class="empty-cart-container reveal" style="display:none;"></div>' +
      '  <div id="wishlistContent">' +
      '    <div id="wishlistSkeleton" class="wishlist-skeleton reveal" style="display:none;"></div>' +
      '    <div id="wishlistError" class="empty-cart-container reveal" style="display:none;"></div>' +
      '    <div class="catalog-grid" id="wishlistGrid"></div>' +
      '  </div>' +
      '</section></main>';
    localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 3, name: 'Colgante Sol', price: 2200, emoji: '☀️', image: '' }]));
    require(path.join(JS_DIR, 'config.js'));
    require(path.join(JS_DIR, 'ui.js'));
    require(path.join(JS_DIR, 'wishlist.js'));
    window.addToCart = jest.fn();
    window.renderProductImage = jest.fn(function () { return '<img class="product-card-img" />'; });

    require(path.join(PAGES_DIR, 'wishlist.js'));

    expect(document.getElementById('wishlistGrid').innerHTML).toContain('Colgante Sol');
    expect(document.getElementById('emptyWishlist').style.display).toBe('none');
  });

  test('recibe wishlist_updated y vuelve a renderizar (sync entre pestañas)', () => {
    loadSharedModules();
    require(path.join(PAGES_DIR, 'wishlist.js'));

    expect(typeof window.renderWishlist).toBe('function');

    // Otra pestaña agrega un favorito y dispara el sync
    window.addToWishlist({ id: 9, name: 'Pulsera Nueva', price: 300, emoji: '📿', image: '' });
    window.renderWishlist();

    expect(document.getElementById('wishlistGrid').innerHTML).toContain('Pulsera Nueva');
    expect(document.getElementById('wishlistCount').textContent).toBe('1');
  });

  test('el grid usa la clase responsive catalog-grid (consistencia con el catálogo)', () => {
    loadSharedModules();
    require(path.join(PAGES_DIR, 'wishlist.js'));
    var grid = document.getElementById('wishlistGrid');
    // Clase compartida con el catálogo: responsive 3-4 / 2 / 1 vías media queries
    expect(grid.className).toContain('catalog-grid');
  });
});
