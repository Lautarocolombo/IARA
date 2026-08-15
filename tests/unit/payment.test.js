/**
 * Tests unitarios para payment.js
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

describe('payment.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('initPayment oculta botón de Mercado Pago', () => {
    document.body.innerHTML = `
      <button id="mp-checkout-btn">Pagar</button>
      <div id="mp-checkout-container">MP Container</div>
    `;
    require('../../frontend/js/payment');
    window.initPayment();
    expect(document.getElementById('mp-checkout-btn').style.display).toBe('none');
    expect(document.getElementById('mp-checkout-container').style.display).toBe('none');
  });

  test('initPayment maneja elementos ausentes', () => {
    document.body.innerHTML = '';
    require('../../frontend/js/payment');
    expect(() => window.initPayment()).not.toThrow();
  });

  test('initPayment no falla si solo existe el botón', () => {
    document.body.innerHTML = '<button id="mp-checkout-btn">Pagar</button>';
    require('../../frontend/js/payment');
    expect(() => window.initPayment()).not.toThrow();
  });

  test('initPayment no falla si solo existe el contenedor', () => {
    document.body.innerHTML = '<div id="mp-checkout-container">MP</div>';
    require('../../frontend/js/payment');
    expect(() => window.initPayment()).not.toThrow();
  });

  test('initPayment mantiene otros estilos intactos', () => {
    document.body.innerHTML = `
      <button id="mp-checkout-btn" style="color:red">Pagar</button>
      <div id="mp-checkout-container" style="color:blue">MP</div>
    `;
    require('../../frontend/js/payment');
    window.initPayment();
    expect(document.getElementById('mp-checkout-btn').style.color).toBe('red');
    expect(document.getElementById('mp-checkout-container').style.color).toBe('blue');
    expect(document.getElementById('mp-checkout-btn').style.display).toBe('none');
    expect(document.getElementById('mp-checkout-container').style.display).toBe('none');
  });
});
