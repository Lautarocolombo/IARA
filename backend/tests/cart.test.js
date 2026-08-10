const request = require('supertest');

const bcrypt = require('bcryptjs');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ADMIN_USER = process.env.ADMIN_USER || 'testadmin';
process.env.ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || bcrypt.hashSync('testpassword123', 10);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || process.env.TEST_BASE_URL || 'http://localhost:3000';
process.env.DATABASE_URL = '';

const { app, dbReady } = require('../src/server');

process.env.PORT = process.env.PORT || '3001';
const API_BASE = `http://localhost:${process.env.PORT}`;

describe('Cart API', () => {
  let sessionToken = '';

  beforeAll(async () => {
    if (dbReady && typeof dbReady.then === 'function') {
      await dbReady;
    }
  });

  test('crea sesion de carrito', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('sessionToken');
    expect(res.body).toHaveProperty('items');
    sessionToken = res.body.sessionToken;
  });

  test('agrega item al carrito', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .send({ session_token: sessionToken, product_id: 1, name: 'Test Product', price: 100, qty: 2 });
    expect(res.statusCode).toBe(200);
    expect(res.body.items['1'].qty).toBe(2);
  });

  test('actualiza cantidad de item', async () => {
    const res = await request(app)
      .patch('/api/cart/items')
      .send({ session_token: sessionToken, items: { '1': { id: 1, name: 'Test Product', price: 100, qty: 5, emoji: '📿', image: '' } } });
    expect(res.statusCode).toBe(200);
    expect(res.body.items['1'].qty).toBe(5);
  });

  test('elimina item del carrito', async () => {
    const res = await request(app)
      .delete('/api/cart/items')
      .send({ session_token: sessionToken, product_id: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.items['1']).toBeUndefined();
  });

  test('crea orden con envio por zona', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        items: [{ id: 1, name: 'Test Product', price: 100, qty: 1 }],
        shipping_name: 'Cliente Test',
        shipping_address: 'Calle Falsa 123',
        shipping_zip: '3200',
        shipping_city: 'Gualeguay',
        shipping_province: 'Entre Ríos',
        shipping_phone: '+5493444123456',
        shipping_email: 'test@example.com',
        total: 2100
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('waMessage');
    expect(res.body.shippingProvince).toBe('Entre Ríos');
  });
});
