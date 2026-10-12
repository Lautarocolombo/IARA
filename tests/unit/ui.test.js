/**
 * Tests unitarios para ui.js (utilidades)
 */

describe('ui.js utilidades', () => {
  beforeEach(() => {
    jest.resetModules();
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

  test('getFetchErrorMessage devuelve mensaje util', () => {
    const uiModule = require('../../frontend/js/ui');
    expect(uiModule.getFetchErrorMessage(new Error('Network error'))).toBe('Error de conexión. Intentá nuevamente.');
    expect(uiModule.getFetchErrorMessage({ message: 'HTTP 500', status: 500 })).toBe('Error del servidor. Intentá de nuevo en unos minutos.');
    expect(uiModule.getFetchErrorMessage({ message: 'HTTP 429', status: 429 })).toBe('Demasiadas solicitudes. Esperá un minuto y volvé a intentar.');
  });

  test('showToast crea un elemento toast en el DOM', () => {
    document.body.innerHTML = '<div id="toastContainer"></div>';
    const uiModule = require('../../frontend/js/ui');
    uiModule.showToast('⚠️', 'Mensaje de prueba', 'error', { duration: 100 });
    const container = document.getElementById('toastContainer');
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain('Mensaje de prueba');
  });

  test('showToast no hace nada si no existe el contenedor', () => {
    document.body.innerHTML = '';
    const uiModule = require('../../frontend/js/ui');
    expect(() => uiModule.showToast('⚠️', 'Mensaje', 'error')).not.toThrow();
  });

  test('showToast con onRetry incluye botón reintentar', () => {
    document.body.innerHTML = '<div id="toastContainer"></div>';
    const uiModule = require('../../frontend/js/ui');
    const onRetry = jest.fn();
    uiModule.showToast('⚠️', 'Error', 'error', { onRetry, duration: 100 });
    const container = document.getElementById('toastContainer');
    expect(container.innerHTML).toContain('toast-retry');
    expect(container.innerHTML).toContain('Reintentar');
  });

  test('showToast con onRetry ejecuta onRetry al hacer click', () => {
    document.body.innerHTML = '<div id="toastContainer"></div>';
    const uiModule = require('../../frontend/js/ui');
    const onRetry = jest.fn();
    uiModule.showToast('⚠️', 'Error', 'error', { onRetry, duration: 0 });
    const container = document.getElementById('toastContainer');
    const retryBtn = container.querySelector('.toast-retry');
    retryBtn.click();
    expect(onRetry).toHaveBeenCalled();
  });

  test('initMobileNavbar toggle abre y cierra menú', () => {
    const uiModule = require('../../frontend/js/ui');
    const toggle = document.createElement('button');
    toggle.id = 'navbarToggle';
    toggle.className = 'navbar-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.id = 'navbarMenu';
    menu.className = 'navbar-menu';
    menu.innerHTML = '<a class="nav-link">Inicio</a>';
    document.body.appendChild(toggle);
    document.body.appendChild(menu);

    uiModule.initMobileNavbar();
    toggle.click();
    expect(menu.classList.contains('active')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(menu.classList.contains('active')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('fetchWithRetry', () => {
  let uiModule;
  let originalFetch;

  beforeEach(() => {
    jest.resetModules();
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    global.CONFIG = {
      API: { BASE: '' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 }
    };
    // Mock localStorage
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    // Mock warmup fetch to /health to avoid extra calls during tests
    global.fetch.mockImplementation((url) => {
      if (url && url.includes('/health')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
      }
      // Default mock for other URLs - tests will override this
      return Promise.reject(new Error('Unexpected fetch to ' + url));
    });
    uiModule = require('../../frontend/js/ui');
    // Clear mock calls after module load (warmup fetch)
    global.fetch.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('éxito en primer intento', async () => {
    const mockRes = { ok: true, status: 200, json: async () => ({ data: 'ok' }), clone: () => mockRes };
    global.fetch.mockResolvedValue(mockRes);

    const res = await uiModule.fetchWithRetry('/api/test', {}, 3, 10, 1000, false);
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    // Verificar que se hizo al menos 1 fetch (el real, warmup ya fue limpiado)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('fetchWithRetry devuelve datos con las opciones nuevas', async () => {
    const payload = { data: 'ok' };
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => payload
    });

    await expect(uiModule.fetchWithRetry('/api/test', {}, {
      retries: 0,
      firstAttemptTimeoutMs: 1000,
      showToastOnError: false
    })).resolves.toEqual(payload);
  });

  test('mantiene legible el cuerpo de respuesta después del fetch', async () => {
    let requestSignal;
    const mockRes = {
      ok: true,
      status: 200,
      json: async () => {
        if (requestSignal.aborted) {
          const error = new Error('The user aborted a request');
          error.name = 'AbortError';
          throw error;
        }
        return { data: 'ok' };
      },
      clone: () => mockRes
    };
    global.fetch.mockImplementation((_url, options) => {
      requestSignal = options.signal;
      return Promise.resolve(mockRes);
    });

    const res = await uiModule.fetchWithRetry('/api/test', {}, 3, 10, 1000, false);

    await expect(res.json()).resolves.toEqual({ data: 'ok' });
    expect(requestSignal.aborted).toBe(false);
  });

  test('timeout en primer intento y éxito en reintento', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'AbortError';
    const mockRes = { ok: true, status: 200, json: async () => ({ data: 'ok' }), clone: () => mockRes };

    global.fetch
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(mockRes);

    const res = await uiModule.fetchWithRetry('/api/test', {}, 3, 10, 100, false);
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    // Verificar que se reintentó (al menos 2 fetches reales)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('agota reintentos y devuelve null', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValue(timeoutError);

    const res = await uiModule.fetchWithRetry('/api/test', {}, 2, 10, 100, false);
    expect(res).toBeNull();
    // Verificar que se agotaron reintentos (al menos 3 fetches reales)
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  test('NO reintenta en 4xx (400, 401, 403, 404)', async () => {
    const mockRes400 = { ok: false, status: 400, statusText: 'Bad Request', json: async () => ({}), clone: () => mockRes400 };
    const mockRes401 = { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}), clone: () => mockRes401 };
    const mockRes403 = { ok: false, status: 403, statusText: 'Forbidden', json: async () => ({}), clone: () => mockRes403 };
    const mockRes404 = { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}), clone: () => mockRes404 };

    for (const mockRes of [mockRes400, mockRes401, mockRes403, mockRes404]) {
      jest.resetModules();
      global.fetch = jest.fn().mockResolvedValue(mockRes);
      global.CONFIG = { API: { BASE: '' }, ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 } };
      global.localStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
      global.fetch.mockImplementation((url) => {
        if (url && url.includes('/health')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
        }
        return Promise.resolve(mockRes);
      });
      const ui = require('../../frontend/js/ui');
      global.fetch.mockClear(); // Clear warmup call
      const res = await ui.fetchWithRetry('/api/test', {}, 3, 10, 1000, false);
      expect(res).toBeNull();
      // Solo 1 fetch real (sin reintentos)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }
  });

  test('deduplicación de GET idénticos en vuelo', async () => {
    const mockRes = { ok: true, status: 200, json: async () => ({ data: 'ok' }), clone: () => mockRes };
    global.fetch.mockResolvedValue(mockRes);

    const promises = [
      uiModule.fetchWithRetry('/api/test', {}, 3, 10, 1000, false),
      uiModule.fetchWithRetry('/api/test', {}, 3, 10, 1000, false),
      uiModule.fetchWithRetry('/api/test', {}, 3, 10, 1000, false)
    ];

    const results = await Promise.all(promises);
    expect(results.every(r => r && r.ok)).toBe(true);
    // Solo 1 fetch real gracias a deduplicación
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('localStorage fallo no rompe fetch (cache opcional)', async () => {
    const mockRes = { ok: true, status: 200, json: async () => ({ data: 'ok' }), clone: () => mockRes };
    global.fetch.mockResolvedValue(mockRes);

    global.localStorage.getItem = jest.fn(() => { throw new Error('Quota exceeded'); });
    global.localStorage.setItem = jest.fn(() => { throw new Error('Quota exceeded'); });

    const res = await uiModule.fetchWithRetry('/api/site-texts', {}, 3, 10, 1000, false);
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
  });

  test('reintenta en 502/503/504', async () => {
    const mockRes502 = { ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({}), clone: () => mockRes502 };
    const mockResOk = { ok: true, status: 200, json: async () => ({ data: 'ok' }), clone: () => mockResOk };

    global.fetch
      .mockResolvedValueOnce(mockRes502)
      .mockResolvedValueOnce(mockResOk);

    const res = await uiModule.fetchWithRetry('/api/test', {}, 3, 10, 1000, false);
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    // Verificar que se reintentó (2 fetches reales)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('no reintenta métodos no idempotentes en /api/orders', async () => {
    const mockRes500 = { ok: false, status: 500, statusText: 'Server Error', json: async () => ({}), clone: () => mockRes500 };
    global.fetch.mockResolvedValue(mockRes500);

    const res = await uiModule.fetchWithRetry('/api/orders', { method: 'POST' }, 3, 10, 1000, false);
    expect(res).toBeNull();
    // Solo 1 fetch real (sin reintentos por método no idempotente)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
