jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/parser', () => ({
  safeJsonParse: jest.fn((v, d) => (typeof v === 'string' ? JSON.parse(v || '[]') : (v || d)))
}));

const { query } = require('../src/lib/db');
const { getEarnings } = require('../src/controllers/earningsController');

describe('earningsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEarnings', () => {
    test('retorna métricas básicas sin filtros', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [] });

      await getEarnings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          kpis: expect.objectContaining({
            totalRevenue: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            manualSalesTotal: 0
          }),
          pagination: expect.objectContaining({
            page: 1,
            limit: 15
          })
        })
      );
    });

    test('aplica paginación correctamente', async () => {
      const req = { query: { page: '2', limit: '10' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '25' }], rowCount: 25 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [] });

      await getEarnings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: {
            page: 2,
            limit: 10,
            total: 25,
            pages: 3
          }
        })
      );
    });

    test('aplica límite máximo de 50', async () => {
      const req = { query: { limit: '100' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [] });

      await getEarnings(req, res);

      expect(res.json).toHaveBeenCalled();
      const call = res.json.mock.calls[0][0];
      expect(call.pagination.limit).toBe(50);
    });

    test('filtra por start_date y end_date', async () => {
      const req = { query: { start_date: '2024-01-01', end_date: '2024-01-31' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [] });

      await getEarnings(req, res);

      const orderQuery = query.mock.calls[3][0];
      expect(orderQuery).toContain('substr(created_at, 1, 10) >= $1');
      expect(orderQuery).toContain('substr(created_at, 1, 10) <= $2');
    });

    test('retorna 400 para start_date inválida', async () => {
      const req = { query: { start_date: 'invalid-date' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'start_date debe ser una fecha válida en formato YYYY-MM-DD' });
    });

    test('retorna 400 para end_date inválida', async () => {
      const req = { query: { end_date: 'invalid-date' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'end_date debe ser una fecha válida en formato YYYY-MM-DD' });
    });

    test('retorna 400 si start_date > end_date', async () => {
      const req = { query: { start_date: '2024-02-01', end_date: '2024-01-01' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'start_date no puede ser posterior a end_date' });
    });

    test('calcula avgOrderValue correctamente', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '1000' }], rowCount: 1000 });
      query.mockResolvedValueOnce({ rows: [{ total: '1000' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 500, items: '[]', created_at: '2024-01-01' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });

      try {
        await getEarnings(req, res);
      } catch (err) {
        console.log('ACTUAL ERROR:', err.message);
        throw err;
      }

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          kpis: expect.objectContaining({
            totalRevenue: 1000,
            totalOrders: 1000,
            avgOrderValue: 1,
            manualSalesTotal: 0
          })
        })
      );
    });

    test('retorna 500 en error de DB', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
