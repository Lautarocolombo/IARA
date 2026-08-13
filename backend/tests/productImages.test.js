/* eslint-env jest */
const request = require('supertest');
const { query } = require('../src/lib/db');
const fs = require('fs');
const path = require('path');

const bcrypt = require('bcryptjs');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ADMIN_USER = process.env.ADMIN_USER || 'testadmin';
process.env.ADMIN_PASS_HASH = bcrypt.hashSync('testpassword123', 10);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || process.env.TEST_BASE_URL || 'http://localhost:3000';
process.env.DATABASE_URL = '';
process.env.BACKEND_URL = process.env.BACKEND_URL || process.env.TEST_BASE_URL || 'http://localhost:3000';

const { app, dbReady } = require('../src/server');

const TEST_PRODUCT_NAME = 'Producto Test Imagenes __test__';
const UPLOADS_PRODUCTS_DIR = path.join(__dirname, '..', 'uploads', 'products');
const TEST_IMAGE_FILES = ['test-principal.webp', 'test-secundaria.webp'];

async function cleanup(name) {
  await query('DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE name = $1)', [name]);
  await query('DELETE FROM products WHERE name = $1', [name]);
}

beforeAll(async () => {
  if (dbReady && typeof dbReady.then === 'function') {
    await dbReady;
  }
  await cleanup(TEST_PRODUCT_NAME);
  // Crear archivos de imagen de test para que getPublicUrl los encuentre en filesystem
  if (!fs.existsSync(UPLOADS_PRODUCTS_DIR)) {
    fs.mkdirSync(UPLOADS_PRODUCTS_DIR, { recursive: true });
  }
  TEST_IMAGE_FILES.forEach(f => {
    const filePath = path.join(UPLOADS_PRODUCTS_DIR, f);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'fake-image-data');
    }
  });
});

afterAll(async () => {
  await cleanup(TEST_PRODUCT_NAME);
  // Limpiar archivos de test
  TEST_IMAGE_FILES.forEach(f => {
    const filePath = path.join(UPLOADS_PRODUCTS_DIR, f);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});

async function loginToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.ADMIN_USER, password: 'testpassword123' });
  return res.body.token;
}

describe('Product images on public API', () => {
  test('GET /api/products resuelve image e images desde la galería', async () => {
    const insert = await query(
      'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE) RETURNING id',
      [TEST_PRODUCT_NAME, 'test-imagenes', 'pulseras', 100, '', '📿', '', '', 10, false, true, 'TEST-SKU']
    );
    const productId = insert.rows[0].id;

    await query(
      'INSERT INTO product_images (product_id, url, filename, orden, es_principal, descripcion, categoria) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [productId, '/uploads/products/test-principal.webp', 'test-principal.webp', 0, true, 'Principal', 'pulseras']
    );
    await query(
      'INSERT INTO product_images (product_id, url, filename, orden, es_principal, descripcion, categoria) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [productId, '/uploads/products/test-secundaria.webp', 'test-secundaria.webp', 1, false, 'Secundaria', 'pulseras']
    );

    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const found = res.body.find(p => p.id === productId);
    expect(found).toBeTruthy();
    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    expect(found.image).toBe(`${baseUrl}/uploads/products/test-principal.webp`);
    expect(Array.isArray(found.images)).toBe(true);
    expect(found.images.length).toBe(2);
    expect(found.images[0].url).toBe(`${baseUrl}/uploads/products/test-principal.webp`);
    expect(found.images[0].es_principal).toBeTruthy();
  });

  test('Marcar principal sincroniza products.image', async () => {
    const productRes = await query('SELECT id FROM products WHERE name = $1', [TEST_PRODUCT_NAME]);
    const productId = productRes.rows[0].id;

    const imagesRes = await query('SELECT id, url FROM product_images WHERE product_id = $1 ORDER BY orden ASC', [productId]);
    const img2 = imagesRes.rows.find(r => r.url === '/uploads/products/test-secundaria.webp');
    expect(img2).toBeTruthy();

    const token = await loginToken();
    console.log('Test token:', token ? 'present' : 'missing');
    const patchRes = await request(app)
      .patch(`/api/products/${productId}/images/${img2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ es_principal: true });
    expect(patchRes.statusCode).toBe(200);

    const res = await request(app).get('/api/products');
    const found = res.body.find(p => p.id === productId);
    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    expect(found.image).toBe(`${baseUrl}/uploads/products/test-secundaria.webp`);
    expect(found.images[1].es_principal).toBeTruthy();
    expect(found.images[0].es_principal).toBe(0);
  });

  test('Borrar la imagen principal re-sincroniza products.image', async () => {
    const productName = 'Producto Test Borrado __test__';
    await cleanup(productName);

    const insert = await query(
      'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE) RETURNING id',
      [productName, 'test-borrado', 'pulseras', 100, '', '📿', '', '', 10, false, true, 'TEST-SKU-B']
    );
    const productId = insert.rows[0].id;

    const img1 = await query(
      'INSERT INTO product_images (product_id, url, filename, orden, es_principal, descripcion, categoria) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [productId, 'https://res.cloudinary.com/demo/image1.webp', 'image1.webp', 0, true, 'Principal', 'pulseras']
    );
    const img2 = await query(
      'INSERT INTO product_images (product_id, url, filename, orden, es_principal, descripcion, categoria) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [productId, 'https://res.cloudinary.com/demo/image2.webp', 'image2.webp', 1, false, 'Secundaria', 'pulseras']
    );
    const img1Id = img1.rows[0].id;

    const token = await loginToken();

    let res = await request(app).get('/api/products');
    let found = res.body.find(p => p.id === productId);
    expect(found.image).toBe('https://res.cloudinary.com/demo/image1.webp');

    const delRes = await request(app)
      .delete(`/api/products/${productId}/images/${img1Id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.statusCode).toBe(200);

    const colRes = await query('SELECT image FROM products WHERE id = $1', [productId]);
    expect(colRes.rows[0].image).toBe('https://res.cloudinary.com/demo/image2.webp');

    res = await request(app).get('/api/products');
    found = res.body.find(p => p.id === productId);
    expect(found.image).toBe('https://res.cloudinary.com/demo/image2.webp');
    expect(found.images.length).toBe(1);

    await cleanup(productName);
  });

  test('getPublicUrl retorna vacío para imágenes locales perdidas (filesystem efímero)', async () => {
    const productName = 'Producto Test Perdido __test__';
    await cleanup(productName);

    const insert = await query(
      'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE) RETURNING id',
      [productName, 'test-perdido', 'pulseras', 100, '', '📿', '', '', 10, false, true, 'TEST-PERDIDO']
    );
    const productId = insert.rows[0].id;

    await query(
      'INSERT INTO product_images (product_id, url, filename, orden, es_principal, descripcion, categoria) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [productId, '/uploads/products/non-existent-file.webp', 'non-existent-file.webp', 0, true, 'Perdida', 'pulseras']
    );

    const res = await request(app).get('/api/products');
    const found = res.body.find(p => p.id === productId);
    expect(found).toBeTruthy();
    expect(found.image).toBe('');
    expect(found.images[0].url).toBe('');

    await cleanup(productName);
  });
});
