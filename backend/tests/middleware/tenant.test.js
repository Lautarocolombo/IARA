jest.mock('../../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) })),
  setTenant: jest.fn()
}));

const jwt = require('jsonwebtoken');
const { query, setTenant } = require('../../src/lib/db');
const { tenantContext } = require('../../src/middleware/tenant');

describe('tenant middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('tenantContext', () => {
    test('establece tenant por defecto sin token', async () => {
      const req = {
        headers: {}
      };
      const res = {};
      const next = jest.fn();

      await tenantContext(req, res, next);

      expect(setTenant).toHaveBeenCalledWith('default');
      expect(req.tenantId).toBe('default');
      expect(next).toHaveBeenCalled();
    });

    test('establece tenant desde token con tenant_id', async () => {
      const token = jwt.sign({ tenant_id: 'tenant-1', role: 'admin' }, 'test-secret');
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      const next = jest.fn();

      await tenantContext(req, res, next);

      expect(setTenant).toHaveBeenCalledWith('tenant-1');
      expect(req.tenantId).toBe('tenant-1');
      expect(next).toHaveBeenCalled();
    });

    test('establece tenant desde token con user buscando en DB', async () => {
      const token = jwt.sign({ user: 'testuser', role: 'admin' }, 'test-secret');
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      const next = jest.fn();

      query.mockResolvedValueOnce({ rows: [{ tenant_id: 'tenant-from-db' }] });

      await tenantContext(req, res, next);

      expect(query).toHaveBeenCalledWith('SELECT tenant_id FROM users WHERE username = $1', ['testuser']);
      expect(setTenant).toHaveBeenCalledWith('tenant-from-db');
      expect(req.tenantId).toBe('tenant-from-db');
      expect(next).toHaveBeenCalled();
    });

    test('usa default si token tiene username pero DB no tiene tenant_id', async () => {
      const token = jwt.sign({ user: 'testuser', role: 'admin' }, 'test-secret');
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      const next = jest.fn();

      query.mockResolvedValueOnce({ rows: [] });

      await tenantContext(req, res, next);

      expect(query).toHaveBeenCalledWith('SELECT tenant_id FROM users WHERE username = $1', ['testuser']);
      expect(setTenant).toHaveBeenCalledWith('default');
      expect(req.tenantId).toBe('default');
      expect(next).toHaveBeenCalled();
    });
    test('usa x-admin-token header como alternativa', async () => {
      const token = jwt.sign({ tenant_id: 'tenant-x', role: 'admin' }, 'test-secret');
      const req = {
        headers: { 'x-admin-token': token }
      };
      const res = {};
      const next = jest.fn();

      await tenantContext(req, res, next);

      expect(setTenant).toHaveBeenCalledWith('tenant-x');
      expect(req.tenantId).toBe('tenant-x');
      expect(next).toHaveBeenCalled();
    });

    test('usa default si token inválido', async () => {
      const req = {
        headers: { authorization: 'Bearer invalid-token' }
      };
      const res = {};
      const next = jest.fn();

      await tenantContext(req, res, next);

      expect(setTenant).toHaveBeenCalledWith('default');
      expect(req.tenantId).toBe('default');
      expect(next).toHaveBeenCalled();
    });

    test('continúa con default si JWT_SECRET no está configurado', async () => {
      delete process.env.JWT_SECRET;

      const req = {
        headers: { authorization: 'Bearer some-token' }
      };
      const res = {};
      const next = jest.fn();

      await tenantContext(req, res, next);

      expect(setTenant).toHaveBeenCalledWith('default');
      expect(next).toHaveBeenCalled();
    });

    test('busca tenant en DB para user pero usa default si no existe', async () => {
      const token = jwt.sign({ user: 'nonexistent', role: 'admin' }, 'test-secret');
      const req = {
        headers: { authorization: `Bearer ${token}` }
      };
      const res = {};
      const next = jest.fn();

      query.mockResolvedValueOnce({ rows: [] });

      await tenantContext(req, res, next);

      expect(query).toHaveBeenCalledWith('SELECT tenant_id FROM users WHERE username = $1', ['nonexistent']);
      expect(setTenant).toHaveBeenCalledWith('default');
      expect(req.tenantId).toBe('default');
      expect(next).toHaveBeenCalled();
    });

    test('llama a next incluso en error', async () => {
      const req = {
        headers: { authorization: 'Bearer valid-token' }
      };
      const res = {};
      const next = jest.fn();

      query.mockRejectedValueOnce(new Error('DB connection lost'));

      await tenantContext(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
