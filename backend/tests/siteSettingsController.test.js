jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const {
  getSiteSettings,
  updateSiteSettings,
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getPublicPaymentConfig
} = require('../src/controllers/siteSettingsController');

describe('siteSettingsController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getSiteSettings', () => {
    test('retorna settings con payment config', async () => {
      const req = { query: {} };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ key: 'business_name', value: 'Mi Negocio' }] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'test', transfer_alias: 'test2' }] });

      await getSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        business_name: 'Mi Negocio',
        payment: expect.any(Object)
      }));
    });

    test('crea payment config si no existe', async () => {
      const req = { query: {} };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'artesaniagualeguay' }] });

      await getSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        payment: expect.any(Object)
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSiteSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateSiteSettings', () => {
    test('actualiza settings y payment config', async () => {
      const req = {
        body: {
          business_name: 'Nuevo Nombre',
          payment: { mp_alias: 'nuevo-alias', cash_enabled: true }
        }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, mp_alias: 'nuevo-alias' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await updateSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('actualiza solo settings sin payment', async () => {
      const req = {
        body: {
          business_name: 'Nuevo Nombre',
          phone: '1234567890'
        }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('maneja error de base de datos', async () => {
      const req = { body: { business_name: 'Test' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateSiteSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAdminPaymentConfig', () => {
    test('retorna config de pago existente', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'test', transfer_alias: 'test2' }] });

      await getAdminPaymentConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        mpAlias: 'test',
        transferAlias: 'test2'
      }));
    });

    test('crea config si no existe', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'artesaniagualeguay' }] });

      await getAdminPaymentConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        mpAlias: 'artesaniagualeguay'
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getAdminPaymentConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateAdminPaymentConfig', () => {
    test('actualiza config de pago', async () => {
      const req = {
        body: {
          mpAlias: 'nuevo-alias',
          transferAlias: 'nuevo-transfer',
          cashEnabled: true,
          shippingCost: 500
        }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await updateAdminPaymentConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        mpAlias: 'nuevo-alias',
        cashEnabled: true,
        shippingCost: 500
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { body: { mpAlias: 'test' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateAdminPaymentConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPublicPaymentConfig', () => {
    test('retorna config pública existente', async () => {
      const req = { query: {} };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ transfer_alias: 'test', whatsapp: '+5493444634444', active: true }] });

      await getPublicPaymentConfig(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        transferAlias: 'test',
        active: true
      }));
    });

    test('retorna defaults si no existe config', async () => {
      const req = { query: {} };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await getPublicPaymentConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        active: true,
        mpEnabled: false,
        cashEnabled: false,
        shippingCost: 0
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPublicPaymentConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
