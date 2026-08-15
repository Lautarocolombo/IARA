jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const { getSiteConfig } = require('../src/controllers/siteConfigController');

describe('siteConfigController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_ANALYTICS_ID;
    delete process.env.FACEBOOK_PIXEL_ID;
    delete process.env.WHATSAPP;
    delete process.env.NODE_ENV;
  });

  describe('getSiteConfig', () => {
    test('retorna config pública del sitio', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ key: 'google_analytics_id', value: 'UA-123' }] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'test-alias', holder_name: 'Test', whatsapp: '123', message: 'Msg', active: true }] });

      await getSiteConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          analytics: expect.objectContaining({
            googleId: 'UA-123',
            facebookPixelId: ''
          }),
          payment: expect.objectContaining({
            mpAlias: 'test-alias',
            holderName: 'Test'
          }),
          siteName: 'Artesanía Gualeguay',
          environment: 'development'
        })
      );
    });

    test('usa valores de env como fallback', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: '', holder_name: '', whatsapp: '', message: '', active: true }] });

      process.env.GOOGLE_ANALYTICS_ID = 'UA-ENV';
      process.env.FACEBOOK_PIXEL_ID = 'FB-ENV';
      process.env.WHATSAPP = '+5491234567890';
      process.env.NODE_ENV = 'production';

      await getSiteConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          analytics: {
            googleId: 'UA-ENV',
            facebookPixelId: 'FB-ENV'
          },
          environment: 'production'
        })
      );
    });

    test('limpia caracteres no numéricos de whatsapp', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: '', holder_name: '', whatsapp: '+54 9 3444 634-4444', message: '', active: true }] });

      await getSiteConfig(req, res);

      const calledWith = res.json.mock.calls[0][0];
      expect(calledWith.payment.whatsapp).toBe('54934446344444');
    });

    test('crea payment_config por defecto si no existe', async () => {
      const req = {};
      const res = {
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'iara-salgueiro', holder_name: '', whatsapp: '', message: '', active: true }] });

      await getSiteConfig(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_config')
      );
      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSiteConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
