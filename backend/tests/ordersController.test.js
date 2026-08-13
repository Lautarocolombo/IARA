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
  safeJsonParse: jest.fn((v, d) => (typeof v === 'string' ? JSON.parse(v || '{}') : (v || d)))
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const { getOrders, getUserOrders, getOrderDetail, getPublicOrderTrack } = require('../src/controllers/ordersController');

describe('ordersController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getOrders', () => {
    test('retorna lista de pedidos con paginación', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });

      await getOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        orders: [{ id: 1 }, { id: 2 }],
        total: 2,
        page: 1,
        pages: 1,
        hasMore: false
      });
    });

    test('filtra por status cuando se proporciona', async () => {
      const req = { query: { status: 'pending' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }], rowCount: 1 });

      await getOrders(req, res);

      expect(query.mock.calls[1][0]).toContain('status = $1');
      expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining(['pending']));
    });

    test('filtra por rango de fechas', async () => {
      const req = { query: { start_date: '2024-01-01', end_date: '2024-01-31' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await getOrders(req, res);

      expect(query.mock.calls[1][0]).toContain('date(created_at) >= $1');
      expect(query.mock.calls[1][0]).toContain('date(created_at) <= $2');
    });

    test('maneja errores de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getUserOrders', () => {
    test('retorna pedidos por email', async () => {
      const req = { query: { email: 'test@example.com' } };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await getUserOrders(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    test('retorna 400 si falta email', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getUserOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email es requerido para buscar pedidos' });
    });
  });

  describe('getOrderDetail', () => {
    test('retorna detalle del pedido', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100 }] });

      await getOrderDetail(req, res);

      expect(res.json).toHaveBeenCalledWith({ id: 1, total: 100 });
    });

    test('retorna 404 si no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await getOrderDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPublicOrderTrack', () => {
    test('retorna pedido público sin datos sensibles', async () => {
      const req = { params: { id: 1 } };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, items: '[]', total: 100, status: 'pending', shipping_name: 'Test', created_at: '2024-01-01' }] });

      await getPublicOrderTrack(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalled();
    });
  });
});
