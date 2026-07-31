/**
 * Tests unitarios del backend
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

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

async function getCsrfToken() {
  const res = await request(app).get('/api/csrf-token');
  return res.body.csrfToken || '';
}

async function csrfHeaders() {
  const token = await getCsrfToken();
  return token ? { 'X-CSRF-Token': token } : {};
}

describe('API Backend', () => {
  test('GET /api/health devuelve ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /api/ping devuelve ok', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.statusCode).toEqual(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /api/products devuelve array', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

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

  test('GET /api/testimonials devuelve array', async () => {
    const res = await request(app).get('/api/testimonials');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/site-texts devuelve objeto', async () => {
    const res = await request(app).get('/api/site-texts');
    expect(res.statusCode).toEqual(200);
    expect(typeof res.body).toBe('object');
  });

  test('Ruta inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.statusCode).toEqual(404);
  });

  test('GET /api/admin/products requiere auth', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.statusCode).toEqual(401);
  });

  test('GET /api/admin/products con auth devuelve datos paginados', async () => {
    const res = await request(app).get('/api/admin/products').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
  });

  test('POST /api/admin/products crea producto', async () => {
    const res = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Test', price: 100, category: 'pulseras' });
    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toBe('Test');
  });

  test('PUT /api/admin/products/:id actualiza producto', async () => {
    const res = await request(app).put('/api/admin/products/1').set(authHeaders()).send({ price: 999 });
    expect(res.statusCode).toEqual(200);
    expect(res.body.price).toBe(999);
  });

  test('DELETE /api/admin/products/:id elimina producto', async () => {
    const res = await request(app).delete('/api/admin/products/41').set(authHeaders());
    expect(res.statusCode).toEqual(200);
  });

  test('GET /api/admin/testimonials requiere auth', async () => {
    const res = await request(app).get('/api/admin/testimonials');
    expect(res.statusCode).toEqual(401);
  });

  test('POST /api/admin/testimonials crea testimonio', async () => {
    const res = await request(app).post('/api/admin/testimonials').set(authHeaders()).send({ name: 'Ana', comment: 'Excelente', rating: 5 });
    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toBe('Ana');
  });

  test('PUT /api/admin/testimonials/:id bloquea campos no permitidos', async () => {
    const res = await request(app).put('/api/admin/testimonials/1').set(authHeaders()).send({ name: 'Nuevo', malicious: 'field' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.malicious).toBeUndefined();
  });

  test('GET /api/admin/orders requiere auth', async () => {
    const res = await request(app).get('/api/admin/orders');
    expect(res.statusCode).toEqual(401);
  });

  test('POST /api/orders crea pedido público', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto Stock Test', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/orders').set(csrf).send({ items: [{ id: productId, qty: 1 }], total: 100, shipping_name: 'Test', shipping_address: 'Calle 1', shipping_phone: '123', shipping_zip: '1234' });
    expect(res.statusCode).toEqual(201);
    expect(res.body.status).toBe('pending_payment');
  });

  test('GET /api/orders/public/:id no encontrado', async () => {
    const res = await request(app).get('/api/orders/public/99999');
    expect(res.statusCode).toEqual(404);
  });

  test('POST /api/products/:id/reviews crea reseña', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto Review Test', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const csrf = await csrfHeaders();
    const res = await request(app).post(`/api/products/${productId}/reviews`).set(csrf).send({ customer_name: 'Juan', rating: 5, comment: 'Genial' });
    expect(res.statusCode).toEqual(201);
    expect(res.body.customer_name).toBe('Juan');
    global.reviewId = res.body.id;
    global.reviewProductId = productId;
  });

  test('GET /api/admin/reviews requiere auth', async () => {
    const res = await request(app).get('/api/admin/reviews');
    expect(res.statusCode).toEqual(401);
  });

  test('PUT /api/admin/reviews/:id actualiza reseña', async () => {
    const res = await request(app).put(`/api/admin/reviews/${global.reviewId}`).set(authHeaders()).send({ active: false });
    expect(res.statusCode).toEqual(200);
  });

  test('DELETE /api/admin/reviews/:id elimina reseña', async () => {
    const res = await request(app).delete(`/api/admin/reviews/${global.reviewId}`).set(authHeaders());
    expect(res.statusCode).toEqual(200);
  });

  test('PUT /api/admin/site-texts actualiza texto', async () => {
    const res = await request(app).put('/api/admin/site-texts').set(authHeaders()).send({ key: 'about_text', value: 'Nuevo texto' });
    expect(res.statusCode).toEqual(200);
  });

  test('POST /api/subscribers/subscribe agrega suscriptor', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/subscribers/subscribe').set(csrf).send({ email: 'test@example.com' });
    expect(res.statusCode).toEqual(201);
  });

  test('POST /api/subscribers/subscribe email duplicado hace upsert', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/subscribers/subscribe').set(csrf).send({ email: 'test@example.com' });
    expect(res.statusCode).toEqual(201);
  });

  test('PUT /api/admin/testimonials/:id con campos vacíos falla', async () => {
    const res = await request(app).put('/api/admin/testimonials/1').set(authHeaders()).send({});
    expect(res.statusCode).toEqual(400);
  });

  test('PUT /api/admin/orders/:id con estado inválido devuelve 400', async () => {
    const res = await request(app).put('/api/admin/orders/1').set(authHeaders()).send({ status: 'invalid_status' });
    expect(res.statusCode).toEqual(400);
  });

  test('PUT /api/admin/orders/:id con transición inválida devuelve 409', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Test Status', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const csrf = await csrfHeaders();
    const orderRes = await request(app).post('/api/orders').set(csrf).send({ items: [{ id: productId, qty: 1 }], total: 100, shipping_name: 'Test', shipping_address: 'Calle 1', shipping_phone: '123', shipping_zip: '1234' });
    const orderId = orderRes.body.id;

    const approveRes = await request(app).put(`/api/admin/orders/${orderId}`).set(authHeaders()).send({ status: 'approved' });
    expect(approveRes.statusCode).toEqual(200);

    const invalidRes = await request(app).put(`/api/admin/orders/${orderId}`).set(authHeaders()).send({ status: 'pending' });
    expect(invalidRes.statusCode).toEqual(409);
    expect(invalidRes.body.error).toContain('Transición no permitida');
  });

  test('PUT /api/admin/orders/:id con transición válida funciona', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Test Status 2', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const csrf = await csrfHeaders();
    const orderRes = await request(app).post('/api/orders').set(csrf).send({ items: [{ id: productId, qty: 1 }], total: 100, shipping_name: 'Test', shipping_address: 'Calle 1', shipping_phone: '123', shipping_zip: '1234' });
    const orderId = orderRes.body.id;

    const res = await request(app).put(`/api/admin/orders/${orderId}`).set(authHeaders()).send({ status: 'approved' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe('approved');
  });

  test('isValidTransition valida correctamente', async () => {
    const { isValidTransition } = require('../src/controllers/ordersController');
    expect(isValidTransition('pending', 'approved')).toBe(true);
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
    expect(isValidTransition('approved', 'pending')).toBe(false);
    expect(isValidTransition('delivered', 'cancelled')).toBe(false);
    expect(isValidTransition('pending', 'pending')).toBe(true);
  });

  test('POST /api/admin/products con datos inválidos devuelve 400', async () => {
    const res = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: '', price: -100 });
    expect(res.statusCode).toEqual(400);
  });

  test('PUT /api/admin/products/:id con datos parciales funciona', async () => {
    const res = await request(app).put('/api/admin/products/1').set(authHeaders()).send({ description: 'Descripción actualizada' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.description).toBe('Descripción actualizada');
  });

  test('DELETE /api/admin/products/:id con producto inexistente devuelve 404', async () => {
    const res = await request(app).delete('/api/admin/products/99999').set(authHeaders());
    expect(res.statusCode).toEqual(404);
  });

  test('GET /api/products/:id/reviews con producto inexistente devuelve array vacío', async () => {
    const res = await request(app).get('/api/products/99999/reviews');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  test('POST /api/products/:id/reviews con rating inválido devuelve 400', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/products/1/reviews').set(csrf).send({ customer_name: 'Test', rating: 10, comment: 'Test' });
    expect(res.statusCode).toEqual(400);
  });

  test('POST /api/products/:id/reviews con campos faltantes devuelve 400', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/products/1/reviews').set(csrf).send({ rating: 5 });
    expect(res.statusCode).toEqual(400);
  });

  test('GET /api/admin/products con paginación funciona', async () => {
    const res = await request(app).get('/api/admin/products?page=1&limit=5').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(5);
  });

  test('GET /api/admin/products con search funciona', async () => {
    const res = await request(app).get('/api/admin/products?search=Pulsera').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeDefined();
  });

  test('POST /api/subscribers/subscribe con email inválido devuelve 400', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/subscribers/subscribe').set(csrf).send({ email: 'not-an-email' });
    expect(res.statusCode).toEqual(400);
  });

  test('POST /api/subscribers/unsubscribe con email inexistente devuelve 404', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/subscribers/unsubscribe').set(csrf).send({ email: 'nonexistent@example.com' });
    expect(res.statusCode).toEqual(404);
  });

  test('GET /api/admin/testimonials con paginación funciona', async () => {
    const res = await request(app).get('/api/admin/testimonials?page=1&limit=5').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
  });

  test('POST /api/admin/testimonials con rating inválido devuelve 400', async () => {
    const res = await request(app).post('/api/admin/testimonials').set(authHeaders()).send({ name: 'Test', comment: 'Test', rating: 10 });
    expect(res.statusCode).toEqual(400);
  });

  test('PUT /api/admin/testimonials/:id con estado activo/inactivo funciona', async () => {
    const createRes = await request(app).post('/api/admin/testimonials').set(authHeaders()).send({ name: 'Test', comment: 'Test', rating: 5 });
    const id = createRes.body.id;
    const res = await request(app).put(`/api/admin/testimonials/${id}`).set(authHeaders()).send({ active: false });
    expect(res.statusCode).toEqual(200);
    expect(res.body.active).toBeFalsy();
  });

  test('GET /api/admin/orders con paginación funciona', async () => {
    const res = await request(app).get('/api/admin/orders?page=1&limit=5').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
  });

  test('GET /api/products enriquece con imágenes y reseñas', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('images');
      expect(res.body[0]).toHaveProperty('reviews_count');
      expect(res.body[0]).toHaveProperty('avg_rating');
      expect(Array.isArray(res.body[0].images)).toBe(true);
    }
  });

  test('GET /api/admin/products con filtro de categoría funciona', async () => {
    const res = await request(app).get('/api/admin/products?category=pulseras').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toBeDefined();
    res.body.data.forEach(p => {
      if (p.category) expect(p.category).toBe('pulseras');
    });
  });

  test('GET /api/products/:id/reviews devuelve reseñas públicas', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto Reviews List Test', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const csrf = await csrfHeaders();
    await request(app).post(`/api/products/${productId}/reviews`).set(csrf).send({ customer_name: 'Juan', rating: 5, comment: 'Genial' });
    const res = await request(app).get(`/api/products/${productId}/reviews`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/admin/orders crea pedido desde admin', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto Admin Order Test', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const res = await request(app).post('/api/admin/orders').set(authHeaders()).send({ items: [{ id: productId, name: 'Test', price: 100, quantity: 1 }], total: 100 });
    expect(res.statusCode).toEqual(201);
    expect(res.body.status).toBe('pending');
  });

  test('POST /api/orders con stock insuficiente devuelve 409', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto Stock Bajo', price: 100, category: 'pulseras', stock: 1 });
    const productId = productRes.body.id;
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/orders').set(csrf).send({ items: [{ id: productId, qty: 5 }], total: 500, shipping_name: 'Test', shipping_address: 'Calle 1', shipping_phone: '123', shipping_zip: '1234' });
    expect(res.statusCode).toEqual(409);
    expect(res.body.error).toContain('Stock insuficiente');
  });

  test('PUT /api/admin/orders/:id actualiza estado y mercadopago_id', async () => {
    const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto MP Test', price: 100, category: 'pulseras', stock: 999 });
    const productId = productRes.body.id;
    const orderRes = await request(app).post('/api/admin/orders').set(authHeaders()).send({ items: [{ id: productId, name: 'Test', price: 100, quantity: 1 }], total: 100 });
    const orderId = orderRes.body.id;
    const res = await request(app).put(`/api/admin/orders/${orderId}`).set(authHeaders()).send({ status: 'approved', mercadopago_id: '12345' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe('approved');
  });

  test('GET /api/admin/site-texts devuelve textos con auth', async () => {
    const res = await request(app).get('/api/admin/site-texts').set(authHeaders());
    expect(res.statusCode).toEqual(200);
    expect(typeof res.body).toBe('object');
  });

  test('POST /api/subscribers/unsubscribe sin email devuelve 400', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/subscribers/unsubscribe').set(csrf).send({});
    expect(res.statusCode).toEqual(400);
  });

  test('POST /api/create-preference sin token MP devuelve 500', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/create-preference').set(csrf).send({ items: [] });
    expect(res.statusCode).toEqual(500);
  });

  test('POST /api/payments/webhook sin token MP devuelve 500', async () => {
    const csrf = await csrfHeaders();
    const res = await request(app).post('/api/payments/webhook').set(csrf).send({ type: 'payment', data: { id: '999' } });
    expect(res.statusCode).toEqual(500);
  });

  describe('Product Images CRUD', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    let tempImagePath = '';
    let productId = null;
    let imageId = null;

    beforeAll(async () => {
      tempImagePath = path.join(os.tmpdir(), `test-image-${Date.now()}.jpg`);
      fs.writeFileSync(tempImagePath, Buffer.from('fake-image-data'));
      const productRes = await request(app).post('/api/admin/products').set(authHeaders()).send({ name: 'Producto Image Test', price: 100, category: 'pulseras', stock: 999 });
      productId = productRes.body.id;
    });

    afterAll(async () => {
      try { fs.unlinkSync(tempImagePath); } catch {}
    });

    test('POST /api/admin/product-images/:productId/images sube imagen', async () => {
      const res = await request(app).post(`/api/admin/product-images/${productId}/images`).set(authHeaders()).attach('image', tempImagePath);
      expect(res.statusCode).toEqual(201);
      expect(res.body.url).toBeDefined();
      imageId = res.body.id;
    });

    test('GET /api/admin/product-images/:productId/images lista imágenes', async () => {
      const res = await request(app).get(`/api/admin/product-images/${productId}/images`).set(authHeaders());
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('PUT /api/admin/product-images/:productId/:imageId/primary marca principal', async () => {
      const res = await request(app).put(`/api/admin/product-images/${productId}/images/${imageId}/primary`).set(authHeaders());
      expect(res.statusCode).toEqual(200);
    });

    test('DELETE /api/admin/product-images/:productId/:imageId elimina imagen', async () => {
      const res = await request(app).delete(`/api/admin/product-images/${productId}/images/${imageId}`).set(authHeaders());
      expect(res.statusCode).toEqual(200);
    });

    test('POST imagen a producto inexistente devuelve 404', async () => {
      const res = await request(app).post('/api/admin/product-images/99999/images').set(authHeaders()).attach('image', tempImagePath);
      expect(res.statusCode).toEqual(404);
    });

    test('GET imágenes de producto inexistente devuelve array vacío', async () => {
      const res = await request(app).get('/api/admin/product-images/99999/images').set(authHeaders());
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });
});
