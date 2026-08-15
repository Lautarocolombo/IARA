const { test, expect } = require('@playwright/test');

test('API health responde 200', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
});

test('API products devuelve array', async ({ request }) => {
  const res = await request.get('/api/products');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.products || body)).toBeTruthy();
});

test('API categories devuelve array', async ({ request }) => {
  const res = await request.get('/api/categories');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.categories || body)).toBeTruthy();
});

test('API sitemap devuelve XML', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  expect(text).toContain('xml');
});
