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
const { getSales, createManualSale } = require('../src/controllers/salesController');

describe('salesController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSales', () => {
    test('retorna lista de ventas manuales', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '2' }] });
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, product_id: 1, quantity: 2, unit_price: 100, total: 200, sale_date: '2024-01-01', created_at: '2024-01-01', product_name: 'Pulsera' }
        ]
      });

      await getSales(req, res);

      expect(res.json).toHaveBeenCalledWith({
        sales: [
          { id: 1, product_id: 1, quantity: 2, unit_price: 100, total: 200, sale_date: '2024-01-01', created_at: '2024-01-01', product_name: 'Pulsera' }
        ],
        total: 2,
        limit: 50,
        offset: 0
      });
    });

    test('filtra por start_date', async () => {
      const req = { query: { start_date: '2024-01-01' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSales(req, res);

      expect(query.mock.calls[1][0]).toContain('date(sale_date) >= $1');
    });

    test('filtra por end_date', async () => {
      const req = { query: { end_date: '2024-01-31' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSales(req, res);

      expect(query.mock.calls[1][0]).toContain('date(sale_date) <= $1');
    });

    test('filtra por product_id', async () => {
      const req = { query: { product_id: '1' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSales(req, res);

      expect(query.mock.calls[1][0]).toContain('product_id = $1');
    });

    test('aplica limit y offset', async () => {
      const req = { query: { limit: '10', offset: '20' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getSales(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20
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

      await getSales(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('createManualSale', () => {
    test('crea venta manual exitosamente', async () => {
      const req = {
        body: { product_id: 1, quantity: 2 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Pulsera', price: 100, stock: 10, active: true, deleted: false }]
      });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, quantity: 2, unit_price: 100, total: 200, sale_date: '2024-01-01', created_at: '2024-01-01' }]
      });

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          sale: expect.objectContaining({
            id: 1,
            product_id: 1,
            quantity: 2,
            total: 200
          })
        })
      );
    });

    test('emite syncBus después de crear', async () => {
      const req = {
        body: { product_id: 1, quantity: 2 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Pulsera', price: 100, stock: 10, active: true, deleted: false }]
      });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, quantity: 2, unit_price: 100, total: 200, sale_date: '2024-01-01', created_at: '2024-01-01' }]
      });

      await createManualSale(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('sales_updated', { id: 1 });
    });

    test('retorna 400 si falta product_id', async () => {
      const req = { body: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'product_id es requerido' });
    });

    test('retorna 400 si quantity no es entero positivo', async () => {
      const req = { body: { product_id: 1, quantity: 0 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'quantity debe ser un entero positivo' });
    });

    test('retorna 404 si producto no existe', async () => {
      const req = {
        body: { product_id: 999, quantity: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Producto no encontrado' });
    });

    test('retorna 400 si producto eliminado', async () => {
      const req = {
        body: { product_id: 1, quantity: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Pulsera', price: 100, stock: 10, active: true, deleted: true }]
      });

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se pueden registrar ventas de productos eliminados' });
    });

    test('retorna 400 si precio es negativo', async () => {
      const req = {
        body: { product_id: 1, quantity: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Pulsera', price: -100, stock: 10, active: true, deleted: false }]
      });

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El precio del producto es inválido' });
    });

    test('calcula total correctamente', async () => {
      const req = {
        body: { product_id: 1, quantity: 3 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Pulsera', price: 100, stock: 10, active: true, deleted: false }]
      });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, quantity: 3, unit_price: 100, total: 300, sale_date: '2024-01-01', created_at: '2024-01-01' }]
      });

      await createManualSale(req, res);

      expect(query.mock.calls[1][1]).toEqual([1, 3, 100, 300]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { product_id: 1, quantity: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createManualSale(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
