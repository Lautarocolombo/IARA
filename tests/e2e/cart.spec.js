const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('ag_cart', '[]'));
});

test('cart: página carga con carrito vacío', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('ag_cart', '[]'));
  const res = await page.goto('/pages/cart.html');
  expect(res.status()).toBe(200);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#emptyCart')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#emptyCart h2')).toContainText('vacío');
});

test('cart: agregar producto simulado actualiza badge', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('ag_cart', JSON.stringify([{ id: 1, name: 'Test', price: 100, qty: 1, emoji: '📿', image: '' }]));
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#cartCount')).toHaveText('1');
});

test('cart: persistencia en localStorage', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('ag_cart', JSON.stringify([{ id: 1, name: 'Test', price: 100, qty: 1, emoji: '📿', image: '' }]));
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const cartData = await page.evaluate(() => localStorage.getItem('ag_cart'));
  const parsed = JSON.parse(cartData);
  expect(parsed.length).toBeGreaterThan(0);
});

test('cart: navegar a página de carrito carga correctamente', async ({ page }) => {
  await page.goto('/pages/cart.html');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('h1')).toContainText('Tu carrito de compras');
});
