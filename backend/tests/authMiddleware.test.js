jest.mock('../src/lib/tokenBlacklist', () => ({
  add: jest.fn(),
  has: jest.fn(() => false)
}));

const jwt = require('jsonwebtoken');
const tokenBlacklist = require('../src/lib/tokenBlacklist');
const { adminAuth, adminOnly, requirePermission } = require('../src/middleware/auth');

describe('auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    tokenBlacklist.has.mockReturnValue(false);
  });

  describe('adminAuth', () => {
    test('autoriza con token Bearer válido', async () => {
      const token = jwt.sign({ role: 'admin', user: 'testuser', permissions: {} }, 'test-secret', { expiresIn: '15m' });
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(req.user).toEqual(expect.objectContaining({
        role: 'admin',
        user: 'testuser',
        permissions: {}
      }));
      expect(next).toHaveBeenCalled();
    });

    test('autoriza con x-admin-token header', async () => {
      const token = jwt.sign({ role: 'editor', user: 'editoruser', permissions: {} }, 'test-secret', { expiresIn: '15m' });
      const req = {
        headers: { 'x-admin-token': token }
      };
      const res = {};
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(req.user).toEqual(expect.objectContaining({
        role: 'editor',
        user: 'editoruser',
        permissions: {}
      }));
      expect(next).toHaveBeenCalled();
    });

    test('retorna 401 si no hay token', async () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
      expect(next).not.toHaveBeenCalled();
    });

    test('retorna 401 para token inválido', async () => {
      const req = {
        headers: { authorization: 'Bearer invalid-token' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' });
    });

    test('retorna 401 para token revocado', async () => {
      const token = jwt.sign({ role: 'admin', user: 'testuser', permissions: {} }, 'test-secret', { expiresIn: '15m' });
      tokenBlacklist.has.mockReturnValue(true);

      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token revocado. Iniciá sesión nuevamente.' });
    });

    test('retorna 401 para rol inválido', async () => {
      const token = jwt.sign({ role: 'superadmin', user: 'testuser', permissions: {} }, 'test-secret', { expiresIn: '15m' });
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    test('retorna 500 si JWT_SECRET no está configurado', async () => {
      delete process.env.JWT_SECRET;

      const token = jwt.sign({ role: 'admin', user: 'testuser', permissions: {} }, 'test-secret', { expiresIn: '15m' });
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      await adminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'JWT_SECRET no configurado en el servidor' });
    });
  });

  describe('adminOnly', () => {
    test('permite acceso a admin', () => {
      const req = { user: { role: 'admin' } };
      const res = {};
      const next = jest.fn();

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('deniega acceso a no-admin', () => {
      const req = { user: { role: 'editor' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Solo administradores' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    test('permite acceso a admin sin importar permiso', () => {
      const middleware = requirePermission('products:write');
      const req = { user: { role: 'admin' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('permite acceso si el rol tiene el permiso', () => {
      const middleware = requirePermission('products:write');
      const req = { user: { role: 'editor', permissions: {} } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('permite acceso si permissions tiene el permiso específico', () => {
      const middleware = requirePermission('products:write');
      const req = { user: { role: 'editor', permissions: { 'products:write': true } } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('permite acceso si permissions.all es true', () => {
      const middleware = requirePermission('products:write');
      const req = { user: { role: 'editor', permissions: { all: true } } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('deniega acceso si no tiene permiso', () => {
      const middleware = requirePermission('products:write');
      const req = { user: { role: 'viewer', permissions: {} } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Permiso requerido: products:write' });
    });

    test('retorna 401 si no hay usuario', () => {
      const middleware = requirePermission('products:write');
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });
  });
});
