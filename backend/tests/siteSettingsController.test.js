jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
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
const { getSiteSettings, updateSiteSettings } = require('../src/controllers/siteSettingsController');

describe('siteSettingsController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getSiteSettings', () => {
    test('retorna settings del sitio', async () => {
      const req = {};
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ key: 'business_name', value: 'Mi Negocio' }] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'test', transfer_alias: '', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }] });

      await getSiteSettings(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          business_name: 'Mi Negocio',
          payment: expect.objectContaining({
            mp_alias: 'test',
            shipping_cost: 0
          })
        })
      );
    });

    test('crea payment_config por defecto si no existe', async () => {
      const req = {};
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({
        rows: [{ mp_alias: 'iara-salgueiro', transfer_alias: 'iara-salgueiro', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }]
      });

      await getSiteSettings(req, res);

      const insertCall = query.mock.calls.find(call => typeof call[0] === 'string' && call[0].includes('INSERT INTO payment_config'));
      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain('INSERT INTO payment_config');
      expect(res.json).toHaveBeenCalled();
    });

    test('parsea shipping_zones desde JSON', async () => {
      const req = {};
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ key: 'shipping_zones', value: '[{"province":"BsAs","cost":1500}]' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ mp_alias: 'iara-salgueiro', transfer_alias: '', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }] });

      await getSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          shipping_zones: [{ province: 'BsAs', cost: 1500 }]
        })
      );
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSiteSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateSiteSettings', () => {
    test('actualiza settings básicos', async () => {
      const req = {
        body: { business_name: 'Nuevo Nombre', phone: '123456' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, mp_alias: '', transfer_alias: '', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateSiteSettings(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_settings'),
        ['business_name', 'Nuevo Nombre']
      );
    });

    test('guarda shipping_zones como JSON', async () => {
      const req = {
        body: { shipping_zones: [{ province: 'BsAs', cost: 1500 }] }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, mp_alias: '', transfer_alias: '', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateSiteSettings(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_settings'),
        ['shipping_zones', expect.any(String)]
      );
    });

    test('actualiza payment config cuando hay campos de pago', async () => {
      const req = {
        body: { business_name: 'Nuevo Nombre', payment: { mp_alias: 'new-alias', shipping_cost: 2000 } }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, mp_alias: 'old', transfer_alias: '', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateSiteSettings(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payment_config'),
        expect.arrayContaining(['new-alias', 2000])
      );
    });

    test('emite syncBus después de actualizar', async () => {
      const req = {
        body: { business_name: 'Test' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, mp_alias: '', transfer_alias: '', holder_name: '', cbu_cvu: '', whatsapp: '', message: '', active: true, mp_enabled: false, cash_enabled: false, shipping_cost: 0, free_shipping_from: 0, included_shipping_cost: 0 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateSiteSettings(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('settings_updated', {});
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { business_name: 'Test' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      try {
        await updateSiteSettings(req, res);
      } catch (err) {
        console.log('ERROR:', err.message);
        throw err;
      }

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
