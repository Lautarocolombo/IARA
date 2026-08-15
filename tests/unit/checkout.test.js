/**
 * Tests unitarios para checkout.js
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

// Mock de sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
global.sessionStorage = sessionStorageMock;

// Mock de CONFIG
global.CONFIG = {
  CART: {
    STORAGE_KEY: 'ag_cart',
    SHIPPING_THRESHOLD: 2000,
    SHIPPING_COST: 200,
    FREE_SHIPPING_TEXT: 'Envío Gratis'
  },
  API: { BASE: '' },
  CONTACT: {
    WHATSAPP: '+5493444634444',
    WHATSAPP_ALIAS: 'iara-salgueiro'
  },
  ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 }
};

// Mock de showToast
global.showToast = jest.fn();

// Mock de updateCartBadge
global.updateCartBadge = jest.fn();

// Mock de getCart
global.getCart = jest.fn(() => []);

// Mock de clearCart
global.clearCart = jest.fn();

// Mock de renderProductImage
global.renderProductImage = jest.fn(() => '<img src="" alt="test" />');

// Mock de emitSync
global.emitSync = jest.fn();

// Mock de startDataSync
global.startDataSync = jest.fn();

// Mock de onSyncMessage
global.onSyncMessage = jest.fn();

// Mock de formatARS
global.formatARS = jest.fn((val) => '$' + val);

// Mock de getFetchErrorMessage
global.getFetchErrorMessage = jest.fn(() => 'Error de conexión');

// Mock de loadPaymentConfig
global.loadPaymentConfig = jest.fn();

// Mock de fetchWithRetry
global.fetchWithRetry = jest.fn();

describe('checkout.js', () => {
  let fetchWithRetryMock;
  let checkout;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.resetModules();
    fetchWithRetryMock = jest.fn();
    global.fetchWithRetry = fetchWithRetryMock;
    global.getCart = jest.fn(() => []);
    global.clearCart = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateField', () => {
    beforeEach(() => {
      checkout = require('../../frontend/js/checkout');
    });

    test('devuelve error para nombre vacío', () => {
      expect(checkout.validateField('name', '')).toBe('Ingresá tu nombre');
    });

    test('devuelve error para dirección vacía', () => {
      expect(checkout.validateField('address', '')).toBe('Ingresá tu dirección');
    });

    test('devuelve error para código postal vacío', () => {
      expect(checkout.validateField('zip', '')).toBe('Ingresá el código postal');
    });

    test('devuelve error para localidad vacía', () => {
      expect(checkout.validateField('city', '')).toBe('Ingresá tu localidad');
    });

    test('devuelve error para provincia vacía', () => {
      expect(checkout.validateField('province', '')).toBe('Seleccioná tu provincia');
    });

    test('devuelve error para teléfono vacío', () => {
      expect(checkout.validateField('phone', '')).toBe('Ingresá tu teléfono');
    });

    test('devuelve error para teléfono con menos de 8 dígitos', () => {
      expect(checkout.validateField('phone', '123')).toBe('Ingresá un teléfono válido');
    });

    test('valida teléfono con 8 dígitos', () => {
      expect(checkout.validateField('phone', '34441234')).toBe('');
    });

    test('devuelve error para email vacío', () => {
      expect(checkout.validateField('email', '')).toBe('Ingresá tu email');
    });

    test('devuelve error para email inválido', () => {
      expect(checkout.validateField('email', 'invalid')).toBe('Ingresá un email válido');
    });

    test('valida email correcto', () => {
      expect(checkout.validateField('email', 'test@example.com')).toBe('');
    });

    test('devuelve string vacío para campo válido', () => {
      expect(checkout.validateField('name', 'Juan')).toBe('');
    });
  });

  describe('updateSummary', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="summaryItems"></div>
        <div id="summaryTotals"></div>
        <div id="emptyCart"></div>
        <div id="checkoutContent"></div>
        <div id="freeShippingProgressCheckout"></div>
        <div id="freeShippingFillCheckout"></div>
        <div id="freeShippingTextCheckout"></div>
      `;
      checkout = require('../../frontend/js/checkout');
    });

    test('maneja carrito vacío sin error', () => {
      global.getCart = jest.fn(() => []);
      sessionStorage.clear();
      expect(() => checkout.updateSummary()).not.toThrow();
    });

    test('renderiza items del carrito', () => {
      global.getCart = jest.fn(() => [
        { id: 1, name: 'Producto Test', price: 100, qty: 2, image: '', emoji: '📿' }
      ]);
      checkout.updateSummary();
      expect(document.getElementById('summaryItems').innerHTML).toContain('Producto Test');
    });

    test('calcula subtotal correctamente', () => {
      global.getCart = jest.fn(() => [
        { id: 1, name: 'A', price: 100, qty: 2, image: '', emoji: '📿' },
        { id: 2, name: 'B', price: 50, qty: 1, image: '', emoji: '📿' }
      ]);
      checkout.updateSummary();
      expect(document.getElementById('summaryTotals').innerHTML).toContain('250');
    });
  });

  describe('fetchShippingDiff', () => {
    beforeEach(() => {
      checkout = require('../../frontend/js/checkout');
    });

    test('no hace nada si no hay provincia', async () => {
      await checkout.fetchShippingDiff('');
      expect(fetchWithRetryMock).not.toHaveBeenCalled();
    });

    test('consulta API cuando hay provincia', async () => {
      const mockRes = {
        ok: true,
        json: async () => ({ diff: 100, province: 'Buenos Aires', included_shipping_cost: 50 })
      };
      fetchWithRetryMock.mockResolvedValue(mockRes);
      await checkout.fetchShippingDiff('Buenos Aires');
      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        '/api/shipping-diff?province=Buenos%20Aires',
        {},
        1,
        500
      );
    });

    test('maneja error en la consulta de envío', async () => {
      fetchWithRetryMock.mockRejectedValue(new Error('Network error'));
      await checkout.fetchShippingDiff('Buenos Aires');
      expect(fetchWithRetryMock).toHaveBeenCalled();
    });

    test('maneja respuesta no ok', async () => {
      const mockRes = { ok: false };
      fetchWithRetryMock.mockResolvedValue(mockRes);
      await checkout.fetchShippingDiff('Buenos Aires');
      expect(fetchWithRetryMock).toHaveBeenCalled();
    });
  });

  describe('applyCoupon', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="couponCode" value="" />
        <div id="couponError" style="display:none"></div>
        <div id="couponSuccess" style="display:none"></div>
      `;
      global.getCart = jest.fn(() => []);
      checkout = require('../../frontend/js/checkout');
    });

    test('muestra error cuando el código está vacío', async () => {
      document.getElementById('couponCode').value = '';
      await checkout.applyCoupon();
      expect(document.getElementById('couponError').textContent).toBe('Ingresá un código de cupón');
    });

    test('valida cupón exitosamente', async () => {
      document.getElementById('couponCode').value = 'DESCUENTO10';
      const mockRes = {
        ok: true,
        json: async () => ({ code: 'DESCUENTO10', discount: 100 })
      };
      fetchWithRetryMock.mockResolvedValue(mockRes);
      await checkout.applyCoupon();
      expect(fetchWithRetryMock).toHaveBeenCalledWith('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'DESCUENTO10', amount: 0 })
      }, 2, 1000);
    });

    test('maneja cupón inválido', async () => {
      document.getElementById('couponCode').value = 'INVALID';
      const mockRes = {
        ok: false,
        json: async () => ({ error: 'Cupón inválido' })
      };
      fetchWithRetryMock.mockResolvedValue(mockRes);
      await checkout.applyCoupon();
      expect(document.getElementById('couponError').textContent).toBe('Cupón inválido');
    });

    test('maneja error de red al validar cupón', async () => {
      document.getElementById('couponCode').value = 'DESCUENTO10';
      fetchWithRetryMock.mockRejectedValue(new Error('Network error'));
      await checkout.applyCoupon();
      expect(document.getElementById('couponError').textContent).toBe('Error validando cupón');
    });
  });

  describe('loadMpAlias', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="mpAliasValue"></div>
        <div id="transferAlias"></div>
        <div id="transferCbuCvu"></div>
        <div id="cbuCvuField" style="display:none"></div>
        <div id="transferHolder"></div>
        <div id="holderField" style="display:none"></div>
      `;
      checkout = require('../../frontend/js/checkout');
    });

    test('carga datos de transferencia correctamente', async () => {
      const mockRes = {
        ok: true,
        json: async () => ({
          transferAlias: 'test-alias',
          cbuCvu: 'CBU123',
          holderName: 'Juan Perez',
          whatsapp: '+5493444634444',
          message: 'Transferí el total',
          active: true,
          mpEnabled: false
        })
      };
      fetchWithRetryMock.mockResolvedValue(mockRes);
      const result = await checkout.loadMpAlias();
      expect(result.alias).toBe('test-alias');
      expect(document.getElementById('transferAlias').textContent).toBe('test-alias');
    });

    test('maneja error al cargar configuración de pago', async () => {
      fetchWithRetryMock.mockRejectedValue(new Error('Error'));
      const result = await checkout.loadMpAlias();
      expect(result.alias).toBe(CONFIG.CONTACT.WHATSAPP_ALIAS);
      expect(result.active).toBe(false);
    });

    test('maneja respuesta nula', async () => {
      fetchWithRetryMock.mockResolvedValue(null);
      const result = await checkout.loadMpAlias();
      expect(result.active).toBe(false);
    });
  });

  describe('copyMpAlias', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="mpAliasValue">test-alias</div>
        <button id="copyAliasBtn">Copiar</button>
      `;
      checkout = require('../../frontend/js/checkout');
    });

    test('copia alias exitosamente', async () => {
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue()
      };
      checkout.copyMpAlias();
      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('test-alias');
    });

    test('maneja alias no disponible', () => {
      document.getElementById('mpAliasValue').textContent = 'No configurado';
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue()
      };
      checkout.copyMpAlias();
      expect(global.showToast).toHaveBeenCalledWith('', 'Alias no disponible', 'error');
    });
  });

  describe('copyTransferField', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="transferAlias">test-alias</div>
        <button id="copyTransferAliasBtn">Copiar</button>
      `;
      checkout = require('../../frontend/js/checkout');
    });

    test('copia alias de transferencia', async () => {
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue()
      };
      checkout.copyTransferField('alias');
      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('test-alias');
    });

    test('maneja dato no disponible', async () => {
      document.getElementById('transferAlias').textContent = 'No configurado';
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue()
      };
      checkout.copyTransferField('alias');
      expect(global.showToast).toHaveBeenCalledWith('', 'Dato no disponible', 'error');
    });
  });

  describe('showFieldError y clearFieldError', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="shipName" value="" />
        <div id="error-name" style="display:none"></div>
        <div class="form-group" id="nameGroup"></div>
      `;
      checkout = require('../../frontend/js/checkout');
    });

    test('showFieldError muestra mensaje', () => {
      checkout.showFieldError('name', 'Campo requerido');
      expect(document.getElementById('error-name').textContent).toBe('Campo requerido');
    });

    test('clearFieldError limpia mensaje', () => {
      checkout.showFieldError('name', 'Campo requerido');
      checkout.clearFieldError('name');
      expect(document.getElementById('error-name').textContent).toBe('');
    });
  });

  describe('restoreOrderFromSession', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="paymentOrderId"></div>
        <div id="paymentOrderTotal"></div>
        <div id="transferOrderNumber"></div>
        <div id="transferOrderItems"></div>
        <div id="transferOrderTotalHighlight"></div>
        <div id="whatsappComprobanteBtn"></div>
        <div id="transferReceiptBtn"></div>
        <div id="paymentInstructions" style="display:none"></div>
        <div id="transferDataCard" style="display:none"></div>
        <div id="shippingForm" style="display:none"></div>
        <input id="shipProvince" value="" />
      `;
      checkout = require('../../frontend/js/checkout');
    });

    test('restaura pedido desde sessionStorage', () => {
      const order = {
        number: '#0001',
        total: 1500,
        items: [{ name: 'Producto', qty: 1, price: 1500 }],
        waNumber: '3444000000',
        waMsg: 'Hola',
        shippingProvince: 'Buenos Aires'
      };
      sessionStorage.setItem('ag_last_order', JSON.stringify(order));
      checkout.restoreOrderFromSession();
      expect(document.getElementById('paymentOrderId').textContent).toBe('#0001');
      expect(document.getElementById('shippingForm').style.display).toBe('none');
    });

    test('no hace nada si no hay pedido en sessionStorage', () => {
      sessionStorage.clear();
      checkout.restoreOrderFromSession();
      expect(document.getElementById('paymentOrderId').textContent).toBe('');
    });

    test('maneja JSON inválido en sessionStorage', () => {
      sessionStorage.setItem('ag_last_order', 'invalid json');
      expect(() => checkout.restoreOrderFromSession()).not.toThrow();
    });
  });
});
