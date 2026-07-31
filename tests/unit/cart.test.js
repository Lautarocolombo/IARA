/**
 * Tests unitarios para cart.js
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

// Mock de CONFIG
global.CONFIG = {
  CART: {
    STORAGE_KEY: 'ag_cart',
    SHIPPING_THRESHOLD: 2000,
    SHIPPING_COST: 200,
    FREE_SHIPPING_TEXT: 'Gratis'
  },
  ANIMATIONS: {
    TOAST_DURATION: 3000,
    REVEAL_THRESHOLD: 0.15
  }
};

// Mock de showToast
global.showToast = () => {};

// Mock de updateCartBadge
global.updateCartBadge = () => {};

describe('cart.js', () => {
  let cartModule;

  beforeEach(() => {
    localStorage.clear();
    jest.resetModules();
    cartModule = require('../../public/js/cart');
    // Reset cart state
    cartModule.clearCart();
  });

  test('getCart devuelve array vacío inicialmente', () => {
    expect(cartModule.getCart()).toEqual([]);
  });

  test('addToCart agrega un producto nuevo', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    expect(cartModule.getCart().length).toBe(1);
    expect(cartModule.getCart()[0].id).toBe(1);
    expect(cartModule.getCart()[0].qty).toBe(1);
  });

  test('addToCart incrementa cantidad si ya existe', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    expect(cartModule.getCart().length).toBe(1);
    expect(cartModule.getCart()[0].qty).toBe(2);
  });

  test('removeFromCart elimina producto por id', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    cartModule.addToCart({ id: 2, name: 'Test2', price: 200 });
    cartModule.removeFromCart(1);
    expect(cartModule.getCart().length).toBe(1);
    expect(cartModule.getCart()[0].id).toBe(2);
  });

  test('updateCartQty actualiza cantidad', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    cartModule.updateCartQty(1, 5);
    expect(cartModule.getCart()[0].qty).toBe(5);
  });

  test('updateCartQty no baja de 1', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    cartModule.updateCartQty(1, 0);
    expect(cartModule.getCart()[0].qty).toBe(1);
  });

  test('clearCart vacía el carrito', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    cartModule.clearCart();
    expect(cartModule.getCart().length).toBe(0);
  });

  test('saveCart persiste en localStorage', () => {
    cartModule.addToCart({ id: 1, name: 'Test', price: 100 });
    const raw = localStorage.getItem(CONFIG.CART.STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).length).toBe(1);
  });
});
