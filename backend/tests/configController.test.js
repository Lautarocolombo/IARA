jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const { getPublicConfig } = require('../src/controllers/configController');

describe('configController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes),
      setHeader: jest.fn()
    };
    jest.clearAllMocks();
    process.env.WHATSAPP = '+543444634444';
    process.env.SHIPPING_COST = '200';
    process.env.SHIPPING_THRESHOLD = '2000';
    process.env.BACKEND_URL = 'https://api.example.com';
    process.env.GOOGLE_ANALYTICS_ID = 'GA-123';
    process.env.FACEBOOK_PIXEL_ID = 'FB-456';
    process.env.SENTRY_DSN = 'sentry-dsn';
    process.env.GOOGLE_PLACE_ID = 'place-123';
    process.env.GOOGLE_WRITE_REVIEW_URL = 'https://review.url';
  });

  describe('getPublicConfig', () => {
    test('returns config with defaults when DB returns empty', async () => {
      query
        .mockResolvedValueOnce({ rows: [] }) // site_settings
        .mockResolvedValueOnce({ rows: [] }); // payment_config

      await getPublicConfig(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        CONTACT: expect.objectContaining({
          WHATSAPP: expect.stringMatching(/^54/),
          EMAIL: 'noreply@artesaniagualeguay.com',
          ADDRESS: 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina'
        }),
        CART: expect.objectContaining({
          SHIPPING_COST: 200,
          SHIPPING_THRESHOLD: 2000,
          FREE_SHIPPING_TEXT: 'Envío Gratis'
        }),
        BUSINESS: expect.objectContaining({
          NAME: 'Artesanías Gualeguay',
          SLOGAN: 'Regalos artesanales que cuentan historias'
        }),
        ANALYTICS: expect.objectContaining({
          GOOGLE_ID: 'GA-123',
          FACEBOOK_PIXEL_ID: 'FB-456',
          SENTRY_DSN: 'sentry-dsn'
        }),
        API: expect.objectContaining({
          BASE: '',
          BACKEND_URL: 'https://api.example.com'
        })
      }));
    });

    test('returns config with DB settings overriding defaults', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            { key: 'business_name', value: 'Test Business' },
            { key: 'slogan', value: 'Test Slogan' },
            { key: 'whatsapp', value: '+5491122334455' },
            { key: 'email', value: 'test@example.com' },
            { key: 'shipping_cost', value: '500' },
            { key: 'free_shipping_from', value: '5000' },
            { key: 'instagram', value: 'https://instagram.com/test' },
            { key: 'facebook', value: 'https://facebook.com/test' },
            { key: 'twitter', value: 'https://twitter.com/test' },
            { key: 'google_analytics_id', value: 'GA-DB' },
            { key: 'facebook_pixel_id', value: 'FB-DB' },
            { key: 'sentry_dsn', value: 'sentry-db' },
            { key: 'google_place_id', value: 'place-db' },
            { key: 'google_write_review_url', value: 'https://review.db' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      await getPublicConfig(mockReq, mockRes);

      const config = mockRes.json.mock.calls[0][0];
      expect(config.BUSINESS.NAME).toBe('Test Business');
      expect(config.BUSINESS.SLOGAN).toBe('Test Slogan');
      expect(config.CONTACT.EMAIL).toBe('test@example.com');
      expect(config.CART.SHIPPING_COST).toBe(500);
      expect(config.CART.SHIPPING_THRESHOLD).toBe(5000);
      expect(config.ANALYTICS.GOOGLE_ID).toBe('GA-DB');
      expect(config.ANALYTICS.FACEBOOK_PIXEL_ID).toBe('FB-DB');
      expect(config.ANALYTICS.SENTRY_DSN).toBe('sentry-db');
      expect(config.REVIEWS.GOOGLE_PLACE_ID).toBe('place-db');
      expect(config.REVIEWS.GOOGLE_WRITE_REVIEW_URL).toBe('https://review.db');
      expect(config.LINKS.INSTAGRAM).toBe('https://instagram.com/test');
      expect(config.LINKS.FACEBOOK).toBe('https://facebook.com/test');
      expect(config.LINKS.TWITTER).toBe('https://twitter.com/test');
    });

    test('uses payment_config for shipping and payment settings', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            shipping_cost: 300,
            free_shipping_from: 3000,
            transfer_alias: 'alias-test',
            holder_name: 'Holder Test',
            cbu_cvu: '12345678',
            whatsapp: '+5491199998888',
            message: 'Custom message',
            active: true,
            mp_enabled: false,
            cash_enabled: true,
            included_shipping_cost: 100
          }]
        });

      await getPublicConfig(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        CART: expect.objectContaining({
          SHIPPING_COST: 300,
          SHIPPING_THRESHOLD: 3000
        }),
        PAYMENT: expect.objectContaining({
          transferAlias: 'alias-test',
          holderName: 'Holder Test',
          cbuCvu: '12345678',
          whatsapp: expect.stringMatching(/^54/),
          message: 'Custom message',
          active: true,
          mpEnabled: false,
          cashEnabled: true,
          shippingCost: 300,
          freeShippingFrom: 3000,
          includedShippingCost: 100
        })
      }));
    });

    test('falls back to env vars when DB and payment_config empty', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getPublicConfig(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        CONTACT: expect.objectContaining({
          WHATSAPP: expect.stringMatching(/^54/),
          PHONE: '+54 (3444) 634-4444'
        }),
        CART: expect.objectContaining({
          SHIPPING_COST: 200,
          SHIPPING_THRESHOLD: 2000
        })
      }));
    });

    test('handles DB error gracefully', async () => {
      query.mockRejectedValueOnce(new Error('DB connection failed'));

      await getPublicConfig(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });

    test('returns debug error when DEBUG_API_ERROR is set', async () => {
      process.env.DEBUG_API_ERROR = 'true';
      query.mockRejectedValueOnce(new Error('DB connection failed'));

      await getPublicConfig(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ error: 'DB connection failed' });
      delete process.env.DEBUG_API_ERROR;
    });

    test('normalizes WhatsApp phone correctly when using env var', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getPublicConfig(mockReq, mockRes);

      const config = mockRes.json.mock.calls[0][0];
      expect(config.CONTACT.WHATSAPP).toMatch(/^54/);
    });

    test('handles coords from DB', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            { key: 'lat', value: '-34.6037' },
            { key: 'lng', value: '-58.3816' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      await getPublicConfig(mockReq, mockRes);

      const config = mockRes.json.mock.calls[0][0];
      expect(config.CONTACT.COORDINATES.lat).toBe(-34.6037);
      expect(config.CONTACT.COORDINATES.lng).toBe(-58.3816);
    });

    test('PAYMENT active defaults to true when not set', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ active: null }]
        });

      await getPublicConfig(mockReq, mockRes);

      const config = mockRes.json.mock.calls[0][0];
      expect(config.PAYMENT.active).toBe(true);
    });

    test('PAYMENT mpEnabled and cashEnabled default to true', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ mp_enabled: null, cash_enabled: null }]
        });

      await getPublicConfig(mockReq, mockRes);

      const config = mockRes.json.mock.calls[0][0];
      expect(config.PAYMENT.mpEnabled).toBe(true);
      expect(config.PAYMENT.cashEnabled).toBe(true);
    });
  });
});