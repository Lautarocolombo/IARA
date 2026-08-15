jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  isLocal: false
}));

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

const { query } = require('../src/lib/db');
const { getEarnings } = require('../src/controllers/earningsController');

describe('earningsController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getEarnings', () => {
    test('retorna métricas con fechas válidas', async () => {
      const req = { query: { start_date: '2024-01-01', end_date: '2024-01-31' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
      query.mockResolvedValueOnce({ rows: [{ total: '1000' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
      query.mockResolvedValueOnce({ rows: [{ total: '200' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await getEarnings(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        kpis: expect.any(Object),
        chart: expect.any(Array),
        categories: expect.any(Array),
        transactions: expect.any(Array),
        pagination: expect.any(Object)
      }));
    });

    test('retorna 400 si start_date es inválida', async () => {
      const req = { query: { start_date: 'invalid' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('retorna 400 si end_date es inválida', async () => {
      const req = { query: { end_date: 'invalid' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('retorna 400 si start_date > end_date', async () => {
      const req = { query: { start_date: '2024-02-01', end_date: '2024-01-01' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
