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
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'iara-salgueiro' }] });

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

    test('persiste claves de integraciones (analytics/reviews)', async () => {
      const req = {
        body: {
          business_name: 'Test',
          google_analytics_id: 'G-TEST123',
          facebook_pixel_id: '123456',
          google_place_id: 'ChIJtest',
          google_write_review_url: 'https://example.com/review'
        }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValue({ rows: [] });

      await updateSiteSettings(req, res);

      const calls = query.mock.calls.map((c) => c[1] && c[1][0]).filter(Boolean);
      expect(calls).toContain('google_analytics_id');
      expect(calls).toContain('google_place_id');
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('getSiteSettings expone integraciones', async () => {
      const req = { query: {} };
      const res = { setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ key: 'google_analytics_id', value: 'G-ABC' }] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'a' }] });

      await getSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        google_analytics_id: 'G-ABC'
      }));
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
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'iara-salgueiro' }] });

      await getAdminPaymentConfig(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        mpAlias: 'iara-salgueiro'
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
    test('actualiza solo los campos enviados y responde con el estado persistido', async () => {
      const req = {
        body: {
          mpAlias: 'nuevo-alias',
          transferAlias: 'nuevo-transfer',
          cashEnabled: true,
          shippingCost: 500
        }
      };
      const res = { json: jest.fn() };

      // 1) lectura de la fila actual, 2) UPDATE, 3) lectura del estado ya persistido
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          mp_alias: 'nuevo-alias',
          transfer_alias: 'nuevo-transfer',
          cbu_cvu: '000111222333444555666',
          message: 'Mensaje que no viene en el body',
          cash_enabled: true,
          shipping_cost: 500,
          included_shipping_cost: 1500
        }]
      });

      await updateAdminPaymentConfig(req, res);

      const updateCall = query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE payment_config SET');
      expect(updateCall[0]).not.toContain('cbu_cvu =');
      expect(updateCall[0]).not.toContain('message =');
      expect(updateCall[1]).toEqual(['nuevo-alias', 'nuevo-transfer', true, 500, 1]);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        mpAlias: 'nuevo-alias',
        cashEnabled: true,
        shippingCost: 500,
        cbuCvu: '000111222333444555666',
        message: 'Mensaje que no viene en el body',
        includedShippingCost: 1500
      }));
    });

    test('no borra campos cuando el body viene vacío', async () => {
      const req = { body: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, cbu_cvu: 'cbu-intacto' }] });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, cbu_cvu: 'cbu-intacto', message: 'mensaje-intacto' }]
      });

      await updateAdminPaymentConfig(req, res);

      const statements = query.mock.calls.map(call => String(call[0]));
      expect(statements.some(sql => sql.includes('UPDATE payment_config'))).toBe(false);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        cbuCvu: 'cbu-intacto',
        message: 'mensaje-intacto'
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
