jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/parser', () => ({
  safeJsonParse: jest.fn((v, def) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch (e) { return def; }
    }
    return def;
  })
}));

describe('reportsController', () => {
  let query;
  let db;
  let getSalesReport;
  let getSalesTrend;
  let resetMetrics;
  let getWeeklySummary;
  let getSalesSummary;
  let loggerError;

  beforeEach(() => {
    jest.resetModules();
    query = jest.fn();
    db = require('../src/lib/db');
    db.query = query;
    db.transaction = jest.fn(async (fn) => {
      return fn({ query: query });
    });
    const controller = require('../src/controllers/reportsController');
    getSalesReport = controller.getSalesReport;
    getSalesTrend = controller.getSalesTrend;
    resetMetrics = controller.resetMetrics;
    getWeeklySummary = controller.getWeeklySummary;
    getSalesSummary = controller.getSalesSummary;
    loggerError = require('../src/lib/logger').error;
  });

  describe('getSalesReport', () => {
    test('retorna reporte de ventas con filtros', async () => {
      const req = { query: { start_date: '2024-01-01', end_date: '2024-01-31' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1000', count: '10' }] });
      query.mockResolvedValueOnce({ rows: [{ date: '2024-01-01', total: '500', count: '5' }] });
      query.mockResolvedValueOnce({ rows: [{ items: '[]', total: 100, status: 'confirmed' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Producto 1', category: 'pulseras' }] });

      await getSalesReport(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        sales: expect.any(Object),
        trend: expect.any(Array),
        byProduct: expect.any(Array),
        byCategory: expect.any(Array),
        byStatus: expect.any(Array)
      }));
    });

    test('usa periodo predefinido', async () => {
      const req = { query: { period: '7d' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '500', count: '5' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSalesReport(req, res);

      expect(query).toHaveBeenCalledWith(expect.stringContaining('date(created_at) >='), expect.arrayContaining([expect.any(String)]));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSalesReport(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSalesTrend', () => {
    test('retorna tendencia de ventas', async () => {
      const req = { query: { days: '7' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ date: '2024-01-01', total: '100', count: '2' }] });

      await getSalesTrend(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('usa 7 días por defecto', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await getSalesTrend(req, res);

      expect(query).toHaveBeenCalled();
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSalesTrend(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('resetMetrics', () => {
    test('reinicia métricas borrando datos reales', async () => {
      const req = { query: {}, body: { confirm: true } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValue({ rowCount: 0 });

      await resetMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true })
      );
    });

    test('rechaza sin confirmación', async () => {
      const req = { query: {}, body: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await resetMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {}, body: { confirm: true } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await resetMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getWeeklySummary', () => {
    test('retorna resumen semanal con nivel alto', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1000', count: '50' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getWeeklySummary(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        pedidosSemana: 50,
        totalSemana: 1000,
        nivelVentas: 'Alta'
      }));
    });

    test('retorna resumen semanal con nivel bajo', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '100', count: '2' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getWeeklySummary(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        nivelVentas: 'Baja'
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getWeeklySummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSalesSummary', () => {
    test('retorna resumen semanal', async () => {
      const req = { query: { view: 'weekly' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSalesSummary(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        view: 'weekly',
        groups: expect.any(Array),
        total: 0,
        count: 0
      }));
    });

    test('retorna resumen mensual', async () => {
      const req = { query: { view: 'monthly' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSalesSummary(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        view: 'monthly',
        groups: expect.any(Array)
      }));
    });

    test('agrupa ventas semanales correctamente', async () => {
      const req = { query: { view: 'weekly' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      const today = new Date().toISOString().split('T')[0];
      const rows = [
        { date: today, total: 100 },
        { date: today, total: 200 }
      ];
      query.mockResolvedValueOnce({ rows });
      query.mockResolvedValueOnce({ rows: [] });

      await getSalesSummary(req, res);

      const calledWith = res.json.mock.calls[0][0];
      expect(calledWith.total).toBe(300);
      expect(calledWith.groups.length).toBeGreaterThan(0);
    });

    test('maneja error de base de datos', async () => {
      const req = { query: { view: 'weekly' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSalesSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
