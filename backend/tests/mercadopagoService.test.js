jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const mercadopagoService = require('../src/services/mercadopagoService');
const { query } = require('../src/lib/db');

describe('mercadopagoService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.MP_ACCESS_TOKEN = 'test_token';
  });

  afterEach(() => {
    delete process.env.MP_ACCESS_TOKEN;
  });

  describe('createPreference', () => {
    test('crea preferencia exitosamente con token', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123, init_point: 'https://...' })
      });

      const result = await mercadopagoService.createPreference(
        [{ id: 1, name: 'Producto', price: 1000, quantity: 1 }],
        'cliente@email.com'
      );

      expect(result.id).toBe(123);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/checkout/preferences'), expect.objectContaining({ method: 'POST' }));
    });

    test('retorna error sin access token', async () => {
      delete process.env.MP_ACCESS_TOKEN;
      const result = await mercadopagoService.createPreference([{ name: 'P', price: 1000 }]);
      expect(result.error).toBeDefined();
    });

    test('retorna error si fetch falla', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'bad' }) });

      const result = await mercadopagoService.createPreference([{ name: 'P', price: 1000 }]);
      expect(result.error).toBeDefined();
    });
  });

  describe('getPaymentStatus', () => {
    test('retorna estado de pago', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 456,
          status: 'approved',
          status_detail: 'approved',
          payment_method: { id: 'visa', type: 'credit_card', card_last_four: '1234' },
          transaction_amount: 1000,
          currency_id: 'ARS'
        })
      });

      const result = await mercadopagoService.getPaymentStatus(456);
      expect(result.status).toBe('approved');
      expect(result.payment_method.id).toBe('visa');
    });

    test('retorna error sin token', async () => {
      delete process.env.MP_ACCESS_TOKEN;
      const result = await mercadopagoService.getPaymentStatus(123);
      expect(result.error).toBeDefined();
    });
  });

  describe('processWebhookNotification', () => {
    test('procesa webhook y actualiza orden', async () => {
      query.mockResolvedValue({ rows: [] });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'approved' })
      });

      const result = await mercadopagoService.processWebhookNotification({
        type: 'payment',
        action: 'payment.updated',
        data: { id: 1 }
      });

      expect(result.processed).toBe(true);
    });

    test('deduplica webhook ya procesado', async () => {
      query.mockResolvedValue({ rows: [{ id: 1, status: 'processed' }] });

      const result = await mercadopagoService.processWebhookNotification({
        type: 'payment',
        data: { id: 1 }
      });

      expect(result.processed).toBe(true);
      expect(result.deduplicated).toBe(true);
    });

    test('maneja webhook sin data', async () => {
      const result = await mercadopagoService.processWebhookNotification({});
      expect(result.processed).toBe(false);
    });
  });

  describe('getSupportedPaymentMethods', () => {
    test('retorna lista de métodos de pago', () => {
      const methods = mercadopagoService.getSupportedPaymentMethods();
      expect(methods.length).toBeGreaterThan(0);
      expect(methods.some(m => m.id === 'visa')).toBe(true);
      expect(methods.some(m => m.id === 'transfer')).toBe(true);
    });
  });
});
