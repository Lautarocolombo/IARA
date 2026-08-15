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
const { getUsers, createUser, updateUser, deleteUser } = require('../src/controllers/usersController');

describe('usersController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    test('retorna lista de usuarios', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, username: 'admin', role: 'admin', permissions: '{"all":true}', active: true },
          { id: 2, username: 'user', role: 'viewer', permissions: '{}', active: true }
        ]
      });

      await getUsers(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { id: 1, username: 'admin', role: 'admin', permissions: { all: true }, active: true, last_login: undefined, created_at: undefined, updated_at: undefined },
        { id: 2, username: 'user', role: 'viewer', permissions: {}, active: true, last_login: undefined, created_at: undefined, updated_at: undefined }
      ]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('createUser', () => {
    test('crea usuario exitosamente', async () => {
      const req = {
        body: { username: 'newuser', password: 'pass123', role: 'viewer', active: true }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 3, username: 'newuser', role: 'viewer', permissions: '{}', active: true, created_at: '2024-01-01' }]
      });

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 3,
          username: 'newuser',
          role: 'viewer',
          permissions: {},
          active: true
        })
      );
    });

    test('retorna 400 si faltan username o password', async () => {
      const req = { body: { username: 'newuser' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario y contraseña son requeridos' });
    });

    test('usa rol viewer por defecto', async () => {
      const req = {
        body: { username: 'newuser', password: 'pass123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 3, username: 'newuser', role: 'viewer', permissions: '{}', active: true, created_at: '2024-01-01' }]
      });

      await createUser(req, res);

      expect(query.mock.calls[0][1]).toContain('viewer');
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { username: 'newuser', password: 'pass123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateUser', () => {
    test('actualiza usuario exitosamente', async () => {
      const req = {
        params: { id: 1 },
        body: { username: 'updateduser', role: 'admin' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'updateduser', role: 'admin', permissions: '{}', active: true, created_at: '2024-01-01' }]
      });

      await updateUser(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          username: 'updateduser',
          role: 'admin'
        })
      );
    });

    test('actualiza contraseña', async () => {
      const req = {
        params: { id: 1 },
        body: { password: 'newpass' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'admin', role: 'admin', permissions: '{}', active: true, created_at: '2024-01-01' }]
      });

      await updateUser(req, res);

      expect(query.mock.calls[0][0]).toContain('password_hash = $1');
    });

    test('retorna 400 sin datos para actualizar', async () => {
      const req = {
        params: { id: 1 },
        body: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Sin datos para actualizar' });
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = {
        params: { id: 999 },
        body: { username: 'updated' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { id: 1 },
        body: { username: 'updated' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteUser', () => {
    test('elimina usuario exitosamente', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteUser(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
