const request = require('supertest');

const bcrypt = require('bcryptjs');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ADMIN_USER = process.env.ADMIN_USER || 'testadmin';
process.env.ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || bcrypt.hashSync('testpassword123', 10);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || process.env.TEST_BASE_URL || 'http://localhost:3000';
process.env.DATABASE_URL = '';

const { app, dbReady } = require('../src/server');

let adminToken = '';

beforeAll(async () => {
  if (dbReady && typeof dbReady.then === 'function') {
    await dbReady;
  }
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.ADMIN_USER, password: 'testpassword123' });
  if (loginRes.body && loginRes.body.token) {
    adminToken = loginRes.body.token;
  }
});

describe('API Endpoints', () => {
  describe('GET /api/products', () => {
    test('devuelve lista de productos', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/products/search', () => {
    test('devuelve array vacío sin query', async () => {
      const res = await request(app).get('/api/products/search');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/site-texts', () => {
    test('devuelve objeto de textos del sitio', async () => {
      const res = await request(app).get('/api/site-texts');
      expect(res.statusCode).toBe(200);
      expect(typeof res.body).toBe('object');
    });
  });

  describe('GET /api/site-config', () => {
    test('devuelve configuración pública del sitio', async () => {
      const res = await request(app).get('/api/site-config');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('analytics');
      expect(res.body).toHaveProperty('payment');
      expect(res.body).toHaveProperty('siteName');
    });
  });

  describe('POST /api/contact', () => {
    test('devuelve 400 si faltan campos', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({ name: 'Test', email: 'test@test.com' });
      expect(res.statusCode).toBe(400);
    });

    test('devuelve 201 con datos válidos', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({ name: 'Test User', email: 'test@test.com', message: 'Test message' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('ok', true);
    });
  });

  describe('POST /api/subscribe', () => {
    test('devuelve 400 sin email', async () => {
      const res = await request(app)
        .post('/api/subscribe')
        .send({ email: 'invalid' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/admin/products (no autorizado)', () => {
    test('devuelve 401 sin token', async () => {
      const res = await request(app).get('/api/admin/products');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/admin/orders (no autorizado)', () => {
    test('devuelve 401 sin token', async () => {
      const res = await request(app).get('/api/admin/orders');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/login', () => {
    test('devuelve 400 sin credenciales', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.statusCode).toBe(400);
    });

    test('devuelve 401 con credenciales inválidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: process.env.ADMIN_USER || 'Iara', password: 'wrongpassword' });
      expect(res.statusCode).toBe(401);
    });
  });
});

