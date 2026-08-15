/**
 * Tests unitarios para wishlist.js
 */

// Mock de localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
global.localStorage = localStorageMock;

// Mock de showToast
global.showToast = jest.fn();

describe('wishlist.js', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.resetModules();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWishlist', () => {
    test('devuelve array vacío si no hay datos', () => {
      require('../../frontend/js/wishlist');
      expect(window.getWishlist()).toEqual([]);
    });

    test('devuelve array vacío si localStorage tiene JSON inválido', () => {
      localStorage.setItem('ag_wishlist', 'invalid json');
      require('../../frontend/js/wishlist');
      expect(window.getWishlist()).toEqual([]);
    });

    test('devuelve wishlist guardada', () => {
      const wishlistData = [
        { id: 1, name: 'Producto A', price: 100 },
        { id: 2, name: 'Producto B', price: 200 }
      ];
      localStorage.setItem('ag_wishlist', JSON.stringify(wishlistData));
      require('../../frontend/js/wishlist');
      expect(window.getWishlist()).toEqual(wishlistData);
    });
  });

  describe('saveWishlist', () => {
    test('guarda wishlist en localStorage', () => {
      require('../../frontend/js/wishlist');
      const data = [{ id: 1, name: 'Producto A', price: 100 }];
      window.saveWishlist(data);
      expect(JSON.parse(localStorage.getItem('ag_wishlist'))).toEqual(data);
    });

    test('actualiza el badge de wishlist', () => {
      document.body.innerHTML = '<span id="wishlistCount">0</span><button id="wishlistToggle"></button>';
      require('../../frontend/js/wishlist');
      window.saveWishlist([{ id: 1, name: 'A', price: 100 }]);
      expect(document.getElementById('wishlistCount').textContent).toBe('1');
    });
  });

  describe('isInWishlist', () => {
    test('devuelve true si el producto está en wishlist', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      expect(window.isInWishlist(1)).toBe(true);
    });

    test('devuelve false si el producto no está en wishlist', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      expect(window.isInWishlist(2)).toBe(false);
    });

    test('devuelve false si wishlist está vacía', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([]));
      require('../../frontend/js/wishlist');
      expect(window.isInWishlist(1)).toBe(false);
    });
  });

  describe('addToWishlist', () => {
    test('agrega producto nuevo a wishlist', () => {
      require('../../frontend/js/wishlist');
      window.addToWishlist({ id: 1, name: 'Producto A', price: 100, emoji: '📿', image: '' });
      expect(window.getWishlist().length).toBe(1);
      expect(window.getWishlist()[0].id).toBe(1);
    });

    test('no duplica productos existentes', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      window.addToWishlist({ id: 1, name: 'Producto A', price: 100 });
      expect(window.getWishlist().length).toBe(1);
    });

    test('muestra toast de éxito', () => {
      require('../../frontend/js/wishlist');
      window.addToWishlist({ id: 1, name: 'Producto A', price: 100, emoji: '📿', image: '' });
      expect(global.showToast).toHaveBeenCalledWith('', 'Producto A agregado a favoritos', 'success');
    });

    test('preserva emoji e imagen del producto', () => {
      require('../../frontend/js/wishlist');
      window.addToWishlist({ id: 1, name: 'A', price: 100, emoji: '💎', image: 'img.jpg' });
      const item = window.getWishlist()[0];
      expect(item.emoji).toBe('💎');
      expect(item.image).toBe('img.jpg');
    });

    test('usa emoji por defecto si no se proporciona', () => {
      require('../../frontend/js/wishlist');
      window.addToWishlist({ id: 1, name: 'A', price: 100 });
      const item = window.getWishlist()[0];
      expect(item.emoji).toBe('📿');
    });

    test('usa imagen vacía si no se proporciona', () => {
      require('../../frontend/js/wishlist');
      window.addToWishlist({ id: 1, name: 'A', price: 100 });
      const item = window.getWishlist()[0];
      expect(item.image).toBe('');
    });
  });

  describe('removeFromWishlist', () => {
    test('elimina producto de wishlist', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([
        { id: 1, name: 'A', price: 100 },
        { id: 2, name: 'B', price: 200 }
      ]));
      require('../../frontend/js/wishlist');
      window.removeFromWishlist(1);
      expect(window.getWishlist().length).toBe(1);
      expect(window.getWishlist()[0].id).toBe(2);
    });

    test('no hace nada si el producto no existe', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      window.removeFromWishlist(99);
      expect(window.getWishlist().length).toBe(1);
    });

    test('elimina el único producto', () => {
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      window.removeFromWishlist(1);
      expect(window.getWishlist()).toEqual([]);
    });
  });

  describe('updateWishlistBadge', () => {
    test('actualiza contador del badge', () => {
      document.body.innerHTML = '<span id="wishlistCount">0</span><button id="wishlistToggle"></button>';
      localStorage.setItem('ag_wishlist', JSON.stringify([
        { id: 1, name: 'A', price: 100 },
        { id: 2, name: 'B', price: 200 }
      ]));
      require('../../frontend/js/wishlist');
      window.updateWishlistBadge();
      expect(document.getElementById('wishlistCount').textContent).toBe('2');
    });

    test('agrega clase show cuando hay items', () => {
      document.body.innerHTML = '<span id="wishlistCount">0</span><button id="wishlistToggle"></button>';
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      window.updateWishlistBadge();
      expect(document.getElementById('wishlistCount').classList.contains('show')).toBe(true);
    });

    test('no agrega clase show cuando no hay items', () => {
      document.body.innerHTML = '<span id="wishlistCount">0</span><button id="wishlistToggle"></button>';
      localStorage.setItem('ag_wishlist', JSON.stringify([]));
      require('../../frontend/js/wishlist');
      window.updateWishlistBadge();
      expect(document.getElementById('wishlistCount').classList.contains('show')).toBe(false);
    });

    test('actualiza aria-pressed del toggle', () => {
      document.body.innerHTML = '<span id="wishlistCount">0</span><button id="wishlistToggle"></button>';
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      window.updateWishlistBadge();
      expect(document.getElementById('wishlistToggle').getAttribute('aria-pressed')).toBe('true');
    });

    test('actualiza clase active del toggle', () => {
      document.body.innerHTML = '<span id="wishlistCount">0</span><button id="wishlistToggle"></button>';
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      window.updateWishlistBadge();
      expect(document.getElementById('wishlistToggle').classList.contains('active')).toBe(true);
    });

    test('no falla si los elementos del DOM no existen', () => {
      document.body.innerHTML = '';
      require('../../frontend/js/wishlist');
      expect(() => window.updateWishlistBadge()).not.toThrow();
    });
  });

  describe('DOMContentLoaded', () => {
    test('actualiza badge al cargar el DOM', (done) => {
      document.body.innerHTML = '<span id="wishlistCount">0</span>';
      localStorage.setItem('ag_wishlist', JSON.stringify([{ id: 1, name: 'A', price: 100 }]));
      require('../../frontend/js/wishlist');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      setTimeout(() => {
        expect(document.getElementById('wishlistCount').textContent).toBe('1');
        done();
      }, 50);
    });
  });

  describe('window exports', () => {
    test('expone addToWishlist', () => {
      require('../../frontend/js/wishlist');
      expect(typeof window.addToWishlist).toBe('function');
    });

    test('expone removeFromWishlist', () => {
      require('../../frontend/js/wishlist');
      expect(typeof window.removeFromWishlist).toBe('function');
    });

    test('expone isInWishlist', () => {
      require('../../frontend/js/wishlist');
      expect(typeof window.isInWishlist).toBe('function');
    });

    test('expone getWishlist', () => {
      require('../../frontend/js/wishlist');
      expect(typeof window.getWishlist).toBe('function');
    });
  });
});
