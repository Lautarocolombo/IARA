jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('$2b$10$mockhashtesthashtesthas')),
  compare: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/tokenBlacklist', () => ({
  add: jest.fn(),
  has: jest.fn(() => false)
}));

const jwt = require('jsonwebtoken');
const { query } = require('../src/lib/db');
const tokenBlacklist = require('../src/lib/tokenBlacklist');
const { login, refresh, logout, hashPassword, changePassword } = require('../src/controllers/authController');

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASS_HASH = '$2b$10$testhashtesthashtesthas';
    tokenBlacklist.has.mockReturnValue(false);
  });

  describe('login', () => {
    test('login exitoso con usuario en DB', async () => {
      const req = {
        body: { username: 'admin', password: 'password123' }
      };
      const res = {
        setHeader: jest.fn(),
        cookie: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$testhashtesthashtesthas',
          role: 'admin',
          permissions: { all: true },
          active: true
        }]
      });

      await login(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/'
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: 'admin',
          role: 'admin'
        })
      );
    });

    test('login exitoso con ADMIN_USER env', async () => {
      const req = {
        body: { username: 'admin', password: 'password123' }
      };
      const res = {
        setHeader: jest.fn(),
        cookie: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({
        rows: [{
          username: 'admin',
          password_hash: '$2b$10$testhashtesthashtesthas',
          role: 'admin',
          permissions: { all: true }
        }]
      });

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: 'admin',
          role: 'admin'
        })
      );
    });

    test('retorna 400 si faltan credenciales', async () => {
      const req = { body: {} };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario y contraseña requeridos' });
    });

    test('retorna 401 para credenciales inválidas', async () => {
      const req = {
        body: { username: 'wrong', password: 'wrong' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
    });

    test('retorna 500 si JWT_SECRET no está configurado', async () => {
      delete process.env.JWT_SECRET;

      const req = {
        body: { username: 'admin', password: 'password123' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$testhashtesthashtesthas',
          role: 'admin',
          permissions: {},
          active: true
        }]
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'JWT_SECRET no configurado en el servidor' });
    });
  });

  describe('refresh', () => {
    test('renueva access token con refresh token válido', async () => {
      const refreshToken = jwt.sign(
        { role: 'admin', user: 'admin', permissions: { all: true } },
        'test-secret',
        { expiresIn: '7d' }
      );

      const req = {
        cookies: { refreshToken }
      };
      const res = {
        cookie: jest.fn(),
        json: jest.fn()
      };

      await refresh(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'adminToken',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000,
          path: '/'
        })
      );
      expect(res.json).toHaveBeenCalledWith({ token: expect.any(String) });
    });

    test('retorna 401 si no hay refresh token', async () => {
      const req = { cookies: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token no proporcionado' });
    });

    test('retorna 401 para refresh token inválido', async () => {
      const req = {
        cookies: { refreshToken: 'invalid-token' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token inválido o expirado' });
    });
  });

  describe('logout', () => {
    test('revoca token y limpia cookie', async () => {
      const req = {
        headers: { authorization: 'Bearer test-token' }
      };
      const res = {
        clearCookie: jest.fn(),
        json: jest.fn()
      };

      tokenBlacklist.has.mockReturnValue(false);

      await logout(req, res);

      expect(tokenBlacklist.add).toHaveBeenCalledWith('test-token');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('logout sin token', async () => {
      const req = { headers: {} };
      const res = {
        clearCookie: jest.fn(),
        json: jest.fn()
      };

      await logout(req, res);

      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('hashPassword', () => {
    test('genera hash bcrypt', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('changePassword', () => {
    test('cambia contraseña exitosamente', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValueOnce(true);

      const req = {
        body: { currentPassword: 'oldpass', newPassword: 'newpass123' },
        user: { user: 'admin' },
        headers: { authorization: 'Bearer test-token' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$oldhashtesthashtesthas'
        }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      await changePassword(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: expect.any(String)
        })
      );
    });

    test('rechaza si falta currentPassword o newPassword', async () => {
      const req = { body: { currentPassword: 'old' }, user: { user: 'admin' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rechaza si newPassword es muy corto', async () => {
      const req = {
        body: { currentPassword: 'old', newPassword: '123' },
        user: { user: 'admin' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    });

    test('rechaza contraseña actual incorrecta', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValueOnce(false);

      const req = {
        body: { currentPassword: 'wrong', newPassword: 'newpass123' },
        user: { user: 'admin' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          password_hash: '$2b$10$testhashtesthashtesthas'
        }]
      });

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña actual incorrecta' });
    });
  });
});
