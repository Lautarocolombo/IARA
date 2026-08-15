jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const { bulkDeleteProducts, bulkToggleProducts } = require('../src/controllers/productsController');

describe('productsController bulk actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bulkDeleteProducts', () => {
    test('elimina productos en bloque', async () => {
      const req = {
        body: { ids: [1, 2, 3] },
        tenant: { id: 'default' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rowCount: 3 });

      await bulkDeleteProducts(req, res);

      expect(res.json).toHaveBeenCalledWith({ deleted: 3 });
    });

    test('retorna 400 si no hay IDs', async () => {
      const req = {
        body: { ids: [] }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await bulkDeleteProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Se requiere un array de IDs' });
    });

    test('maneja error de base de datos', async () => {
      const req = {
        body: { ids: [1] },
        tenant: { id: 'default' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await bulkDeleteProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('bulkToggleProducts', () => {
    test('cambia estado de productos en bloque', async () => {
      const req = {
        body: { ids: [1, 2], active: true },
        tenant: { id: 'default' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rowCount: 2 });

      await bulkToggleProducts(req, res);

      expect(res.json).toHaveBeenCalledWith({ updated: 2 });
    });

    test('retorna 400 si faltan parámetros', async () => {
      const req = {
        body: { ids: [1] }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await bulkToggleProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Se requiere un array de IDs y el estado active' });
    });

    test('desactiva productos', async () => {
      const req = {
        body: { ids: [1], active: false },
        tenant: { id: 'default' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rowCount: 1 });

      await bulkToggleProducts(req, res);

      expect(res.json).toHaveBeenCalledWith({ updated: 1 });
    });
  });
});
