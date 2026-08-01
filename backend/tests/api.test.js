const request = require('supertest');
const path = require('path');

process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_USER = 'iara';
process.env.ADMIN_PASS = 'pulseras2026';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

const app = require(path.join(__dirname, '..', 'src', 'server.js'));

describe('API - Flujos Críticos', () => {
  describe('Health', () => {
    test('GET /api/health devuelve ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('Auth', () => {
    test('POST /api/auth/login sin credenciales devuelve 400', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.statusCode).toEqual(400);
    });

    test('POST /api/auth/login credenciales inválidas devuelve 401', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'wrong', password: 'wrong' });
      expect(res.statusCode).toEqual(401);
    });

    test('POST /api/auth/login correcto devuelve token', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'iara', password: 'pulseras2026' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBe('iara');
    });

    test('POST /api/auth/login con rate limiting devuelve 429', async () => {
      for (let i = 0; i < 6; i++) {
        await request(app).post('/api/auth/login').send({ username: 'wrong', password: 'wrong' });
      }
      const res = await request(app).post('/api/auth/login').send({ username: 'wrong', password: 'wrong' });
      expect(res.statusCode).toEqual(429);
    });
  });

  describe('Products', () => {
    test('GET /api/products devuelve array', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/products/search sin query devuelve array vacío', async () => {
      const res = await request(app).get('/api/products/search');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/products/search con query devuelve resultados', async () => {
      const res = await request(app).get('/api/products/search?q=pulsera');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Orders', () => {
    test('POST /api/orders sin items devuelve 400', async () => {
      const res = await request(app).post('/api/orders').send({});
      expect(res.statusCode).toEqual(400);
    });

    test('POST /api/orders con datos válidos crea pedido', async () => {
      const res = await request(app).post('/api/orders').send({
        items: [{ id: 1, name: 'Test', price: 100, qty: 1 }],
        total: 100,
        customer: { name: 'Test', email: 'test@test.com' }
      });
      expect(res.statusCode).toEqual(201);
    });
  });

  describe('Contact', () => {
    test('POST /api/contact sin datos devuelve 400', async () => {
      const res = await request(app).post('/api/contact').send({});
      expect(res.statusCode).toEqual(400);
    });

    test('POST /api/contact con datos válidos devuelve 201', async () => {
      const res = await request(app).post('/api/contact').send({
        name: 'Test',
        email: 'test@test.com',
        message: 'Mensaje de test'
      });
      expect(res.statusCode).toEqual(201);
    });
  });

  describe('Newsletter', () => {
    test('POST /api/newsletter/subscribe sin email devuelve 400', async () => {
      const res = await request(app).post('/api/newsletter/subscribe').send({});
      expect(res.statusCode).toEqual(400);
    });

    test('POST /api/newsletter/subscribe con email válido devuelve 201', async () => {
      const res = await request(app).post('/api/newsletter/subscribe').send({ email: 'test@test.com' });
      expect(res.statusCode).toEqual(201);
    });
  });

  describe('Reviews', () => {
    test('GET /api/products/1/reviews devuelve array', async () => {
      const res = await request(app).get('/api/products/1/reviews');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Admin', () => {
    let token;

    beforeAll(async () => {
      const login = await request(app).post('/api/auth/login').send({ username: 'iara', password: 'pulseras2026' });
      token = login.body.token;
    });

    test('GET /api/admin/products sin token devuelve 401', async () => {
      const res = await request(app).get('/api/admin/products');
      expect(res.statusCode).toEqual(401);
    });

    test('GET /api/admin/products con token válido devuelve 200', async () => {
      const res = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(200);
    });

    test('POST /api/admin/products sin token devuelve 401', async () => {
      const res = await request(app).post('/api/admin/products').send({ name: 'Test' });
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('Sitemap', () => {
    test('GET /api/sitemap devuelve XML', async () => {
      const res = await request(app).get('/api/sitemap');
      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<urlset');
    });
  });

  describe('Site Config', () => {
    test('GET /api/site-config devuelve configuración pública', async () => {
      const res = await request(app).get('/api/site-config');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('analytics');
      expect(res.body).toHaveProperty('payment');
    });
  });
});