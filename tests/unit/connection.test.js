/**
 * Tests unitarios para connection.js
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

describe('connection.js', () => {
  let connection;
  let fetchMock;
  let originalNavigatorOnLine;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    originalNavigatorOnLine = navigator.onLine;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalNavigatorOnLine,
      writable: true,
      configurable: true
    });
  });

  describe('getStatus', () => {
    test('devuelve estado inicial con online correcto', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      connection = require('../../frontend/js/connection');
      const status = connection.getStatus();
      expect(status).toBeDefined();
      expect(status.online).toBe(true);
      expect(status.backend).toBe('checking');
    });

    test('devuelve objeto con las propiedades esperadas', () => {
      connection = require('../../frontend/js/connection');
      const status = connection.getStatus();
      expect(status).toHaveProperty('online');
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('lastCheck');
      expect(status).toHaveProperty('retryCount');
      expect(status).toHaveProperty('checking');
    });
  });

  describe('subscribe', () => {
    test('devuelve función para desuscribirse', () => {
      connection = require('../../frontend/js/connection');
      const unsub = connection.subscribe(() => {});
      expect(typeof unsub).toBe('function');
    });

    test('notifica a los suscriptores cuando cambia el estado', () => {
      connection = require('../../frontend/js/connection');
      const listener = jest.fn();
      connection.subscribe(listener);
      connection.setStatus({ online: true, backend: 'connected' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('permite desuscribirse', () => {
      connection = require('../../frontend/js/connection');
      const listener = jest.fn();
      const unsub = connection.subscribe(listener);
      unsub();
      connection.setStatus({ online: true, backend: 'connected' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', () => {
    test('actualiza el estado y notifica', () => {
      connection = require('../../frontend/js/connection');
      const listener = jest.fn();
      connection.subscribe(listener);
      connection.setStatus({ backend: 'connected', retryCount: 0 });
      expect(connection.getStatus().backend).toBe('connected');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ backend: 'connected' }));
    });

    test('preserva propiedades existentes', () => {
      connection = require('../../frontend/js/connection');
      connection.setStatus({ online: false });
      expect(connection.getStatus().online).toBe(false);
      expect(connection.getStatus().backend).toBe('checking');
    });
  });

  describe('checkBackend', () => {
    test('llama a /api/health', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' })
      });
      global.fetch = fetchMock;

      await connection.checkBackend();
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' }
        })
      );
    });

    test('marca backend como connected cuando la API responde ok', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' })
      });
      global.fetch = fetchMock;

      await connection.checkBackend();
      const status = connection.getStatus();
      expect(status.backend).toBe('connected');
      expect(status.retryCount).toBe(0);
      expect(status.checking).toBe(false);
    });

    test('marca backend como connected cuando la API responde degraded', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'degraded' })
      });
      global.fetch = fetchMock;

      await connection.checkBackend();
      expect(connection.getStatus().backend).toBe('connected');
    });

    test('marca backend como error cuando la API responde con error', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ status: 'error' })
      });
      global.fetch = fetchMock;

      await connection.checkBackend();
      expect(connection.getStatus().backend).toBe('error');
    });

    test('maneja error de red', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      await connection.checkBackend();
      expect(connection.getStatus().backend).toBe('error');
    });

    test('incrementa retryCount en error', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      await connection.checkBackend();
      expect(connection.getStatus().retryCount).toBe(1);
    });

    test('reinicia retryCount en éxito', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' })
        });
      global.fetch = fetchMock;

      await connection.checkBackend();
      expect(connection.getStatus().retryCount).toBe(1);

      await connection.checkBackend();
      expect(connection.getStatus().retryCount).toBe(0);
    });
  });

  describe('startMonitoring', () => {
    test('verifica estado inicial en línea', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      connection = require('../../frontend/js/connection');
      connection.startMonitoring();
      expect(connection.getStatus().online).toBe(true);
    });

    test('verifica estado inicial fuera de línea', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      connection = require('../../frontend/js/connection');
      connection.startMonitoring();
      expect(connection.getStatus().online).toBe(false);
      expect(connection.getStatus().backend).toBe('checking');
    });

    test('llama a checkBackend al iniciar', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      connection = require('../../frontend/js/connection');
      const checkBackendSpy = jest.spyOn(connection, 'checkBackend').mockResolvedValue();
      connection.startMonitoring();
      expect(checkBackendSpy).toHaveBeenCalled();
    });
  });

  describe('retryNow', () => {
    test('reinicia retryCount y llama checkBackend', async () => {
      connection = require('../../frontend/js/connection');
      const checkBackendSpy = jest.spyOn(connection, 'checkBackend').mockResolvedValue();
      connection.setStatus({ retryCount: 3 });
      connection.retryNow();
      expect(connection.getStatus().retryCount).toBe(0);
      expect(checkBackendSpy).toHaveBeenCalled();
    });
  });

  describe('keepAlive', () => {
    test('ejecuta petición a /api/health', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' })
      });
      global.fetch = fetchMock;

      await connection.keepAlive();
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' }
        })
      );
    });

    test('no lanza error si keepAlive falla', async () => {
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      await expect(connection.keepAlive()).resolves.toBeUndefined();
    });

    test('maneja timeout de keepAlive', async () => {
      jest.useFakeTimers();
      connection = require('../../frontend/js/connection');
      fetchMock = jest.fn().mockImplementation(() => new Promise(() => {}));
      global.fetch = fetchMock;

      const keepAlivePromise = connection.keepAlive();
      await jest.advanceTimersByTimeAsync(6000);
      await keepAlivePromise;
      jest.useRealTimers();
    });
  });

  describe('online/offline events', () => {
    test('maneja evento online', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      connection = require('../../frontend/js/connection');
      connection.startMonitoring();

      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      window.dispatchEvent(new Event('online'));
      expect(connection.getStatus().online).toBe(true);
      expect(connection.getStatus().backend).toBe('checking');
    });

    test('maneja evento offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      connection = require('../../frontend/js/connection');
      connection.startMonitoring();

      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      window.dispatchEvent(new Event('offline'));
      expect(connection.getStatus().online).toBe(false);
      expect(connection.getStatus().backend).toBe('offline');
    });
  });
});
