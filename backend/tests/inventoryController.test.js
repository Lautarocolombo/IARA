jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  isLocal: false,
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const {
  logInventoryMovement,
  getInventoryMovements,
  getInventoryAlerts,
  resolveInventoryAlert
} = require('../src/controllers/inventoryController');

describe('inventoryController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      query: {},
      params: {}
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes)
    };
    jest.clearAllMocks();
  });

  describe('logInventoryMovement', () => {
    test('inserts movement record with all fields', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logInventoryMovement(1, 'sale', 2, 10, 8, 'Venta online', 'order-123');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory_movements'),
        [1, 'sale', 2, 10, 8, 'Venta online', 'order-123']
      );
    });

    test('inserts movement with empty reason and referenceId', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logInventoryMovement(1, 'adjustment', 5, 0, 5, '', '');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory_movements'),
        [1, 'adjustment', 5, 0, 5, '', '']
      );
    });

    test('creates low_stock alert when stock drops below threshold', async () => {
      query
        .mockResolvedValueOnce({ rows: [] }) // movement insert
        .mockResolvedValueOnce({ rows: [] }); // alert insert

      await logInventoryMovement(1, 'sale', 3, 7, 4, 'Venta', 'order-1');

      expect(query).toHaveBeenCalledTimes(2);
      const alertCall = query.mock.calls[1];
      expect(alertCall[0]).toContain('INSERT INTO inventory_alerts');
      expect(alertCall[1]).toEqual([
        1,
        'Stock bajo para producto #1: 4 unidades (umbral: 5)'
      ]);
    });

    test('creates out_of_stock alert when stock reaches zero', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await logInventoryMovement(1, 'sale', 5, 5, 0, 'Venta', 'order-1');

      const alertCall = query.mock.calls[1];
      expect(alertCall[1]).toEqual([
        1,
        'Producto #1 sin stock'
      ]);
    });

    test('does not create alert for non-sale/adjustment types', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logInventoryMovement(1, 'restock', 10, 0, 10, 'Reposición', '');

      expect(query).toHaveBeenCalledTimes(1);
    });

    test('does not create low_stock alert if already below threshold', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logInventoryMovement(1, 'sale', 2, 3, 1, 'Venta', 'order-1');

      expect(query).toHaveBeenCalledTimes(1);
    });

    test('handles DB error gracefully without throwing', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(logInventoryMovement(1, 'sale', 1, 10, 9, '', '')).resolves.not.toThrow();
    });

    test('logs warning on DB error', async () => {
      const logger = require('../src/lib/logger');
      query.mockRejectedValueOnce(new Error('DB error'));

      await logInventoryMovement(1, 'sale', 1, 10, 9, '', '');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'DB error', productId: 1 }),
        'No se pudo registrar movimiento de inventario'
      );
    });
  });

  describe('getInventoryMovements', () => {
    test('returns movements without productId filter', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 1, product_id: 1, type: 'sale' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      await getInventoryMovements(mockReq, mockRes);

      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[0][0]).toContain('SELECT m.*');
      expect(mockRes.json).toHaveBeenCalledWith({
        movements: [{ id: 1, product_id: 1, type: 'sale' }],
        total: 1,
        limit: 100,
        offset: 0
      });
    });

    test('filters by productId when provided', async () => {
      mockReq.query.productId = '5';
      query
        .mockResolvedValueOnce({ rows: [{ id: 2, product_id: 5, type: 'adjustment' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      await getInventoryMovements(mockReq, mockRes);

      expect(query.mock.calls[0][1]).toEqual([5, 100, 0]);
      expect(query.mock.calls[1][1]).toEqual([5]);
    });

    test('uses custom limit and offset', async () => {
      mockReq.query.limit = '50';
      mockReq.query.offset = '10';
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      await getInventoryMovements(mockReq, mockRes);

      expect(query.mock.calls[0][1]).toEqual([50, 10]);
      expect(mockRes.json).toHaveBeenCalledWith({
        movements: [],
        total: 0,
        limit: 50,
        offset: 10
      });
    });

    test('handles DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await getInventoryMovements(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });

    test('handles empty count result', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getInventoryMovements(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        movements: [],
        total: 0,
        limit: 100,
        offset: 0
      });
    });
  });

  describe('getInventoryAlerts', () => {
    test('returns empty alerts if table does not exist (non-local)', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // table check
        .mockResolvedValueOnce({ rows: [] }); // alerts query (not called actually)

      await getInventoryAlerts(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ alerts: [] });
    });

    test('returns unresolved alerts by default', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, product_id: 1, resolved: false }] });

      await getInventoryAlerts(mockReq, mockRes);

      expect(query.mock.calls[1][1]).toEqual([false]);
      expect(mockRes.json).toHaveBeenCalledWith({
        alerts: [{ id: 1, product_id: 1, resolved: false }]
      });
    });

    test('returns resolved alerts when resolved=true', async () => {
      mockReq.query.resolved = 'true';
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, product_id: 1, resolved: true }] });

      await getInventoryAlerts(mockReq, mockRes);

      expect(query.mock.calls[1][1]).toEqual([true]);
    });

    test('handles DB error with dev detail', async () => {
      process.env.NODE_ENV = 'development';
      query.mockRejectedValueOnce(new Error('DB error'));

      await getInventoryAlerts(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Error interno del servidor',
        detail: 'DB error'
      });
      delete process.env.NODE_ENV;
    });

    test('handles DB error without detail in production', async () => {
      process.env.NODE_ENV = 'production';
      query.mockRejectedValueOnce(new Error('DB error'));

      await getInventoryAlerts(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
      delete process.env.NODE_ENV;
    });
  });

  describe('resolveInventoryAlert', () => {
    test('resolves alert and returns it', async () => {
      mockReq.params.id = '42';
      query.mockResolvedValueOnce({ rows: [{ id: 42, resolved: true }] });

      await resolveInventoryAlert(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        'UPDATE inventory_alerts SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [42]
      );
      expect(mockRes.json).toHaveBeenCalledWith({ alert: { id: 42, resolved: true } });
    });

    test('returns 404 when alert not found', async () => {
      mockReq.params.id = '999';
      query.mockResolvedValueOnce({ rows: [] });

      await resolveInventoryAlert(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Alerta no encontrada' });
    });

    test('handles DB error', async () => {
      mockReq.params.id = '1';
      query.mockRejectedValueOnce(new Error('DB error'));

      await resolveInventoryAlert(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });

    test('handles invalid id gracefully', async () => {
      mockReq.params.id = 'abc';
      query.mockResolvedValueOnce({ rows: [] });

      await resolveInventoryAlert(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        'UPDATE inventory_alerts SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [NaN]
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});