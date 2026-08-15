jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const { exportUserData, deleteUserData } = require('../src/controllers/dataController');

describe('dataController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportUserData', () => {
    test('exporta datos del usuario', async () => {
      const req = {
        user: { user: 'testuser' }
      };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ email: 'test@example.com', role: 'user' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, message: 'Hola' }] });

      await exportUserData(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="datos-testuser-')
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'testuser',
          orders: [{ id: 1, total: 100 }],
          contacts: [{ id: 1, message: 'Hola' }]
        })
      );
    });

    test('retorna 401 si no hay usuario', async () => {
      const req = { user: null };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await exportUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = {
        user: { user: 'nonexistent' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await exportUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('busca usuario en tabla customers también', async () => {
      const req = {
        user: { user: 'customer@example.com' }
      };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ email: 'customer@example.com', role: 'customer' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await exportUserData(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UNION SELECT email, role FROM customers'),
        ['customer@example.com']
      );
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        user: { user: 'testuser' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await exportUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteUserData', () => {
    test('elimina datos del usuario', async () => {
      const req = {
        user: { user: 'testuser' }
      };
      const res = {
        clearCookie: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ email: 'test@example.com', role: 'user' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteUserData(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/' });
      expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Datos eliminados correctamente' });
    });

    test('anonimiza datos en lugar de eliminar', async () => {
      const req = {
        user: { user: 'testuser' }
      };
      const res = {
        clearCookie: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ email: 'test@example.com', role: 'user' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteUserData(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('jsonb_set(customer, \'{name}\', \'\'::jsonb)'),
        ['test@example.com']
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("name = 'Anonimizado'"),
        ['test@example.com']
      );
    });

    test('retorna 401 si no hay usuario', async () => {
      const req = { user: null };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await deleteUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = {
        user: { user: 'nonexistent' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        user: { user: 'testuser' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
