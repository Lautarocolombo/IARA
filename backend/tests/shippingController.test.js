jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query, transaction } = require('../src/lib/db');
const { getShippingDiff, getShippingRates, updateShippingRates } = require('../src/controllers/shippingController');

describe('shippingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShippingDiff', () => {
    test('calcula diferencia de envío', async () => {
      const req = { query: { province: 'Buenos Aires' } };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ included_shipping_cost: 1500 }] });
      query.mockResolvedValueOnce({ rows: [{ shipping_cost: 2000 }] });

      await getShippingDiff(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith({
        province: 'Buenos Aires',
        shipping_cost: 2000,
        included_shipping_cost: 1500,
        diff: 500
      });
    });

    test('retorna diff 0 si shipping_cost <= included', async () => {
      const req = { query: { province: 'BsAs' } };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ included_shipping_cost: 1500 }] });
      query.mockResolvedValueOnce({ rows: [{ shipping_cost: 1000 }] });

      await getShippingDiff(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          shipping_cost: 1000,
          included_shipping_cost: 1500,
          diff: 0
        })
      );
    });

    test('retorna 400 si falta provincia', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getShippingDiff(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Provincia requerida' });
    });

    test('usa 0 como fallback para costos', async () => {
      const req = { query: { province: 'Unknown' } };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getShippingDiff(req, res);

      expect(res.json).toHaveBeenCalledWith({
        province: 'Unknown',
        shipping_cost: 0,
        included_shipping_cost: 0,
        diff: 0
      });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { query: { province: 'BsAs' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getShippingDiff(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getShippingRates', () => {
    test('retorna tarifas de envío', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, province: 'Buenos Aires', shipping_cost: 1500, updated_at: '2024-01-01' }
        ]
      });

      await getShippingRates(req, res);

      expect(res.json).toHaveBeenCalledWith({
        rates: [
          { id: 1, province: 'Buenos Aires', shipping_cost: 1500, updated_at: '2024-01-01' }
        ]
      });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getShippingRates(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateShippingRates', () => {
    test('actualiza tarifas en transacción', async () => {
      const req = {
        body: {
          rates: [
            { province: 'Buenos Aires', shipping_cost: 2000 },
            { province: 'Córdoba', shipping_cost: 1800 }
          ]
        }
      };
      const res = { json: jest.fn() };

      await updateShippingRates(req, res);

      expect(transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('ignora tarifas sin provincia', async () => {
      const req = {
        body: {
          rates: [
            { province: '', shipping_cost: 2000 },
            { province: 'Córdoba', shipping_cost: 1800 }
          ]
        }
      };
      const res = { json: jest.fn() };

      await updateShippingRates(req, res);

      expect(query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE shipping_rates_by_province'),
        [2000, ''],
        expect.anything()
      );
    });

    test('convierte shipping_cost a número', async () => {
      const req = {
        body: {
          rates: [
            { province: 'BsAs', shipping_cost: '1500' }
          ]
        }
      };
      const res = { json: jest.fn() };

      await updateShippingRates(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE shipping_rates_by_province'),
        [1500, 'BsAs'],
        expect.anything()
      );
    });

    test('retorna 400 si rates no es array', async () => {
      const req = {
        body: { rates: 'invalid' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateShippingRates(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Se requiere un array de tarifas' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: {
          rates: [
            { province: 'BsAs', shipping_cost: 1500 }
          ]
        }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      transaction.mockRejectedValueOnce(new Error('DB error'));

      await updateShippingRates(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
