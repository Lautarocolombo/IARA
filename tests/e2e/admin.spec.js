const { test, expect } = require('@playwright/test');

test('admin carga con formulario de login', async ({ page }) => {
  const res = await page.goto('/pages/admin.html');
  expect(res.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#loginUser')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#loginPass')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#loginBtn')).toBeVisible({ timeout: 15000 });
});

test('admin muestra título y enlace de volver', async ({ page }) => {
  await page.goto('/pages/admin.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h2')).toContainText('Artesanía Admin');
  await expect(page.locator('.login-back-link')).toContainText('Volver al sitio');
});

test('dashboard requiere autenticación y redirige al login', async ({ page }) => {
  const res = await page.goto('/pages/dashboard.html');
  expect(res.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 15000 });
});

test('logout limpia sesión y vuelve al login', async ({ page }) => {
  await page.goto('/pages/admin.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'admin');
  await page.click('#loginBtn');
  await page.waitForTimeout(1000);
  await page.goto('/pages/admin.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 15000 });
});
