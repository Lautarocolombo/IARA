jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (pw) => `hashed_${pw}`),
  compare: jest.fn(async (pw, hash) => pw === hash.replace('hashed_', ''))
}));

const { query, transaction } = require('../src/lib/db');
const bcrypt = require('bcryptjs');
const { getUsers, getUser, createUser, updateUser, deleteUser, loginUser } = require('../src/controllers/usersController');

describe('usersController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
    bcrypt.hash.mockImplementation(async (pw) => `hashed_${pw}`);
    bcrypt.compare.mockImplementation(async (pw, hash) => pw === hash.replace('hashed_', ''));
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  test('setup - ensure bcrypt mocks work', () => {
    expect(bcrypt.hash).toBeDefined();
    expect(bcrypt.compare).toBeDefined();
  });

  describe('getUsers', () => {
    test('retorna lista de usuarios paginada', async () => {
      const req = { query: { page: 1, limit: 10 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', role: 'admin', active: true }], rowCount: 1 });

      await getUsers(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ users: expect.any(Array), total: 2, page: 1 }));
    });

    test('aplica filtros por role y active', async () => {
      const req = { query: { role: 'editor', active: true } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await getUsers(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ users: [] }));
    });

    test('retorna error 400 con query inválida', async () => {
      const req = { query: { limit: -1 } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      await getUsers(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getUser', () => {
    test('retorna usuario existente', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', role: 'admin' }] });

      await getUser(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, username: 'admin' }));
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = { params: { id: 999 } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [] });

      await getUser(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 con id inválido', async () => {
      const req = { params: { id: 'abc' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      await getUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createUser', () => {
    test('crea usuario exitosamente', async () => {
      const req = { body: { username: 'nuevo', password: 'pass1234', role: 'editor' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 2, username: 'nuevo', role: 'editor', created_at: '2024-01-01' }] });

      await createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ username: 'nuevo' }));
    });

    test('retorna 409 si username ya existe', async () => {
      const req = { body: { username: 'admin', password: 'pass1234' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('valida datos de entrada', async () => {
      const req = { body: { username: 'ab', password: 'short' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      await createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateUser', () => {
    test('actualiza usuario exitosamente', async () => {
      const req = { params: { id: 1 }, body: { role: 'admin' } };
      const res = { json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', role: 'admin' }] });

      await updateUser(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = { params: { id: 999 }, body: { role: 'admin' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [] });

      await updateUser(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('hasheea contraseña si se proporciona', async () => {
      const req = { params: { id: 1 }, body: { password: 'newpass' } };
      const res = { json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await updateUser(req, res);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 10);
    });
  });

  describe('deleteUser', () => {
    test('elimina usuario existente', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin' }] });

      await deleteUser(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test('retorna 404 si usuario no existe', async () => {
      const req = { params: { id: 999 } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [] });

      await deleteUser(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('loginUser', () => {
    test('login exitoso', async () => {
      const req = { body: { username: 'admin', password: 'pass1234' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', password_hash: 'hashed_pass1234', role: 'admin', permissions: '{}', tenant_id: 'default' }] });

      await loginUser(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String), user: 'admin' }));
    });

    test('retorna 401 con credenciales inválidas', async () => {
      const req = { body: { username: 'admin', password: 'wrong' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', password_hash: 'hashed_pass1234' }] });

      await loginUser(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
