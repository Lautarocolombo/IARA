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
const { getSalesReport, getSalesTrend, resetMetrics, getWeeklySummary } = require('../src/controllers/reportsController');

describe('reportsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSalesReport', () => {
    test('retorna reporte de ventas con datos', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1000', count: 2 }] });
      query.mockResolvedValueOnce({ rows: [{ date: '2024-01-01', total: '500', count: 1 }] });
      query.mockResolvedValueOnce({
        rows: [
          { items: JSON.stringify([{ id: 1, quantity: 2, price: 100 }]), total: 200, status: 'completed' }
        ]
      });
      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Producto A', category: 'cat1' }] });

      await getSalesReport(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sales: { total: '1000', count: 2 },
          trend: [{ date: '2024-01-01', total: '500', count: 1 }],
          byProduct: expect.any(Array),
          byCategory: expect.any(Array),
          byStatus: expect.any(Array),
          ticketPromedio: 500
        })
      );
    });

    test('filtra por período', async () => {
      const req = { query: { period: '7d' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0', count: 0 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSalesReport(req, res);

      const salesQuery = query.mock.calls[0][0];
      const params = query.mock.calls[0][1];
      expect(params.length).toBeGreaterThan(0);
      expect(salesQuery).toContain('date(created_at) >= $1');
    });

    test('calcula ticket promedio como 0 sin ventas', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0', count: 0 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSalesReport(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketPromedio: 0
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

      await getSalesReport(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getSalesTrend', () => {
    test('retorna tendencia de ventas', async () => {
      const req = { query: { days: '7' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', total: 500, count: 2 },
          { date: '2024-01-02', total: 300, count: 1 }
        ]
      });

      await getSalesTrend(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { date: '2024-01-01', total: 500, count: 2 },
        { date: '2024-01-02', total: 300, count: 1 }
      ]);
    });

    test('usa días por defecto 7', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await getSalesTrend(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $1'),
        [expect.any(String)]
      );
    });

    test('retorna 500 en error de DB', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSalesTrend(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('resetMetrics', () => {
    test('reinicia métricas', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await resetMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          reset_at: expect.any(String)
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

      await resetMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getWeeklySummary', () => {
    test('retorna resumen semanal con nivel alto', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ count: 10, total: 10000 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getWeeklySummary(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pedidosSemana: 10,
          totalSemana: 10000,
          nivelVentas: 'Alta'
        })
      );
    });

    test('retorna nivel bajo cuando hay datos históricos', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ count: 2, total: 400 }] });
      query.mockResolvedValueOnce({
        rows: [
          { date: '2023-12-25', total: 200, count: 1 },
          { date: '2023-12-26', total: 200, count: 1 },
          { date: '2023-12-27', total: 200, count: 1 },
          { date: '2023-12-28', total: 200, count: 1 },
          { date: '2023-12-29', total: 200, count: 1 },
          { date: '2023-12-30', total: 200, count: 1 },
          { date: '2023-12-31', total: 200, count: 1 }
        ]
      });

      await getWeeklySummary(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          nivelVentas: 'Baja'
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

      await getWeeklySummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
