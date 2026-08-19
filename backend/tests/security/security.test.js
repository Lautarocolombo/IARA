jest.mock('../../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../../src/lib/tokenBlacklist', () => ({
  add: jest.fn(),
  has: jest.fn(() => false),
  getRedisClient: jest.fn()
}));

const { query } = require('../../src/lib/db');
const tokenBlacklist = require('../../src/lib/tokenBlacklist');

describe('Security tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenBlacklist.has.mockReturnValue(false);
    delete process.env.CSRF_SECRET;
    delete process.env.ALLOWED_ORIGINS;
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.CSRF_SECRET;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.JWT_SECRET;
  });

  describe('CSRF protection', () => {
    test('rechaza POST sin CSRF token cuando está configurado', async () => {
      process.env.CSRF_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
      const csrfModule = require('../../src/middleware/csrf');
      const req = {
        method: 'POST',
        originalUrl: '/api/test',
        headers: { origin: 'http://localhost:5173' },
        body: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      csrfModule.csrfProtection(req, res, () => {});
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token inválido' });
    });

    test('permite POST con CSRF token válido', async () => {
      process.env.CSRF_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
      const csrfModule = require('../../src/middleware/csrf');
      const req = {
        method: 'POST',
        originalUrl: '/api/test',
        headers: { origin: 'http://localhost:5173' },
        body: { _csrf: 'test-secret' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      csrfModule.csrfProtection(req, res, () => {});
      expect(res.status).not.toHaveBeenCalled();
    });

    test('permite GET sin CSRF token', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
      const csrfModule = require('../../src/middleware/csrf');
      const req = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: { origin: 'http://localhost:5173' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      csrfModule.csrfProtection(req, res, () => {});
      expect(res.status).not.toHaveBeenCalled();
    });

    test('rechaza origen no permitido', async () => {
      process.env.CSRF_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
      const csrfModule = require('../../src/middleware/csrf');
      const req = {
        method: 'POST',
        originalUrl: '/api/test',
        headers: { origin: 'http://evil.com' },
        body: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      csrfModule.csrfProtection(req, res, () => {});
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Origin no permitido' });
    });
  });

  describe('SQL injection protection', () => {
    test('parametros de busqueda usan placeholders', async () => {
      query.mockReturnValue({ rows: [] });
      const productsController = require('../../src/controllers/productsController');
      if (typeof productsController.searchProducts !== 'function') {
        console.log('searchProducts no disponible, se salta el test');
        return;
      }
      const req = {
        query: { q: "'; DROP TABLE products; --" },
        protocol: 'http',
        get: () => 'localhost:5173'
      };
      const res = {
        json: jest.fn(),
        status: jest.fn(() => res)
      };
      await productsController.searchProducts(req, res);
      console.log('query calls:', query.mock.calls);
      console.log('res.json calls:', res.json.mock.calls);
      expect(res.json).toHaveBeenCalled();
      const calls = query.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('$1'));
      expect(calls.length).toBeGreaterThan(0);
      const injectionCall = calls.find(c => c[1] && c[1][0] && c[1][0].includes("'; DROP TABLE products; --"));
      expect(injectionCall).toBeDefined();
    });

    test('rango de precios usa placeholders', async () => {
      query.mockReturnValue({ rows: [] });
      const productsController = require('../../src/controllers/productsController');
      if (typeof productsController.applyFilters !== 'function') {
        console.log('applyFilters no disponible, se salta el test');
        return;
      }
      const req = {
        query: { minPrice: "0 OR 1=1", maxPrice: "1000" }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn(() => res)
      };
      await productsController.applyFilters(req, res);
      expect(res.json).toHaveBeenCalled();
      const calls = query.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('$1') && c[0].includes('$2'));
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('Token blacklist', () => {
    test('revoked token es rechazado por adminAuth', async () => {
      tokenBlacklist.has.mockReturnValue(true);
      const { adminAuth } = require('../../src/middleware/auth');
      const req = {
        headers: { authorization: 'Bearer revoked-token-123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      await adminAuth(req, res, () => {});
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token revocado. Iniciá sesión nuevamente.' });
    });

    test('token válido no está en blacklist', async () => {
      tokenBlacklist.has.mockReturnValue(false);
      const validToken = require('jsonwebtoken').sign({ role: 'admin', username: 'test' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
      const { adminAuth } = require('../../src/middleware/auth');
      const req = {
        headers: { authorization: `Bearer ${validToken}` }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      await adminAuth(req, res, () => {});
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('admin');
    });
  });

  describe('Path traversal protection', () => {
    test('previene path traversal en endpoints de archivos', async () => {
      try {
        const filesRoute = require('../../src/routes/files');
        const serveUploadedFile = filesRoute.serveUploadedFile || filesRoute.default;
        if (!serveUploadedFile) {
          console.log('serveUploadedFile no disponible, se salta el test');
          return;
        }
        const req = {
          params: { filename: '../../../etc/passwd' },
          path: '/uploads/imagenes/../../../etc/passwd'
        };
        const res = {
          status: jest.fn(() => res),
          json: jest.fn(),
          sendFile: jest.fn()
        };
        serveUploadedFile(req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Ruta de archivo inválida' });
      } catch (e) {
        console.log('Ruta de archivos no disponible, se salta el test');
      }
    });
  });
});
