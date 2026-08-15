jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('$2b$10$mockhashtesthashtesthas')),
  compare: jest.fn(() => Promise.resolve(true))
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: () => 'mocktoken' })),
  createHash: jest.fn(() => ({ update: jest.fn().mockReturnThis(), digest: jest.fn(() => 'mockhash') }))
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

jest.mock('../src/lib/email', () => ({
  sendEmail: jest.fn(() => Promise.resolve(true))
}));

const jwt = require('jsonwebtoken');
const { query } = require('../src/lib/db');
const tokenBlacklist = require('../src/lib/tokenBlacklist');
const { login, refresh, logout, changePassword, requestPasswordReset, resetPassword } = require('../src/controllers/authController');

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASS_HASH = '$2b$10$testhashtesthashtesthas';
    tokenBlacklist.has.mockReturnValue(false);
    query.mockReset();
  });

  describe('requestPasswordReset', () => {
    test('solicita reset exitosamente', async () => {
      const req = {
        body: { email: 'user@example.com' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'user' }] });

      await requestPasswordReset(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
      expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET reset_token'), ['mockhash', 1]);
    });

    test('retorna 400 si falta email', async () => {
      const req = {
        body: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email es requerido' });
    });

    test('no revela si el email existe', async () => {
      const req = {
        body: { email: 'nonexistent@example.com' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await requestPasswordReset(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
    });
  });

  describe('resetPassword', () => {
    test('resetea contraseña exitosamente', async () => {
      const req = {
        body: { token: 'mocktoken', newPassword: 'newpass123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, reset_token_expires: new Date(Date.now() + 60000).toISOString() }] });

      await resetPassword(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Contraseña restablecida correctamente.' });
      expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET password_hash'), expect.any(Array));
    });

    test('retorna 400 si falta token o contraseña', async () => {
      const req = {
        body: { newPassword: 'newpass123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token y nueva contraseña son requeridos' });
    });

    test('retorna 400 si contraseña es muy corta', async () => {
      const req = {
        body: { token: 'mocktoken', newPassword: '123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, reset_token_expires: new Date(Date.now() + 60000).toISOString() }] });

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña debe tener al menos 6 caracteres' });
    });

    test('retorna 400 si token es inválido', async () => {
      const req = {
        body: { token: 'invalidtoken', newPassword: 'newpass123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' });
    });

    test('retorna 400 si token está expirado', async () => {
      const req = {
        body: { token: 'mocktoken', newPassword: 'newpass123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, reset_token_expires: new Date(Date.now() - 60000).toISOString() }] });

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expirado' });
    });
  });
});
