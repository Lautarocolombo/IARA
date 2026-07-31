/**
 * Tests de seguridad y protección CSRF
 */

const request = require('supertest');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_USER = 'Iara';
process.env.ADMIN_PASS = 'pulsera2026';

const app = require(path.join(__dirname, '..', 'src', 'server.js'));

let adminToken = '';

beforeAll(async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'iara', password: 'pulseras2026' });
  adminToken = res.body.token;
});

describe('CSRF Protection', () => {
  test('GET /api/csrf-token devuelve token', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.statusCode).toEqual(200);
    expect(res.body.csrfToken).toBeDefined();
    expect(typeof res.body.csrfToken).toBe('string');
    expect(res.body.csrfToken.length).toBeGreaterThan(20);
  });

  test('POST sin CSRF token devuelve 403', async () => {
    const res = await request(app).post('/api/subscribers/subscribe').send({ email: 'test@example.com' });
    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('CSRF');
  });

  test('POST con CSRF token válido funciona', async () => {
    const tokenRes = await request(app).get('/api/csrf-token');
    const token = tokenRes.body.csrfToken;

    const res = await request(app)
      .post('/api/subscribers/subscribe')
      .set('X-CSRF-Token', token)
      .send({ email: 'csrf-test@example.com' });
    expect(res.statusCode).toEqual(201);
  });

  test('POST con CSRF token inválido devuelve 403', async () => {
    const res = await request(app)
      .post('/api/subscribers/subscribe')
      .set('X-CSRF-Token', 'invalid-token')
      .send({ email: 'test2@example.com' });
    expect(res.statusCode).toEqual(403);
  });

  test('POST con CSRF token reutilizado devuelve 403 (single-use)', async () => {
    const tokenRes = await request(app).get('/api/csrf-token');
    const token = tokenRes.body.csrfToken;

    const res1 = await request(app)
      .post('/api/subscribers/subscribe')
      .set('X-CSRF-Token', token)
      .send({ email: 'reuse-test1@example.com' });
    expect(res1.statusCode).toEqual(201);

    const res2 = await request(app)
      .post('/api/subscribers/subscribe')
      .set('X-CSRF-Token', token)
      .send({ email: 'reuse-test2@example.com' });
    expect(res2.statusCode).toEqual(403);
  });
});

describe('CORS', () => {
  test('Respuesta incluye headers CORS', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['access-control-allow-credentials']).toBeDefined();
  });

  test('Origen no permitido devuelve error', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-site.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Security Headers (Helmet)', () => {
  test('X-Content-Type-Options está presente', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options está presente', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('Content-Security-Policy está presente', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('Auth Middleware', () => {
  test('Token JWT inválido devuelve 401', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.statusCode).toEqual(401);
  });

  test('Token JWT expirado devuelve 401', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign({ role: 'admin', user: 'test' }, 'test-secret', { expiresIn: '-1h' });
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.statusCode).toEqual(401);
  });

  test('Role no autorizado devuelve 401', async () => {
    const jwt = require('jsonwebtoken');
    const userToken = jwt.sign({ role: 'user', user: 'test' }, 'test-secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toEqual(401);
  });
});

describe('Input Validation', () => {
  test('Producto con nombre muy largo devuelve 400', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'A'.repeat(300), price: 100 });
    expect(res.statusCode).toEqual(400);
  });

  test('Producto con precio negativo devuelve 400', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', price: -50 });
    expect(res.statusCode).toEqual(400);
  });

  test('Testimonio con rating fuera de rango devuelve 400', async () => {
    const res = await request(app)
      .post('/api/admin/testimonials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', comment: 'Test', rating: 0 });
    expect(res.statusCode).toEqual(400);
  });

  test('Suscripción con email inválido devuelve 400', async () => {
    const tokenRes = await request(app).get('/api/csrf-token');
    const res = await request(app)
      .post('/api/subscribers/subscribe')
      .set('X-CSRF-Token', tokenRes.body.csrfToken)
      .send({ email: 'not-an-email' });
    expect(res.statusCode).toEqual(400);
  });
});

describe('Rate Limiting', () => {
  test('Health check responde rápidamente', async () => {
    const start = Date.now();
    const res = await request(app).get('/api/health');
    const duration = Date.now() - start;
    expect(res.statusCode).toEqual(200);
    expect(duration).toBeLessThan(1000);
  });
});