const { test, expect } = require('@playwright/test');

test('admin carga con formulario de login', async ({ page }) => {
  const res = await page.goto('/pages/admin.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginUser')).toBeVisible();
  await expect(page.locator('#loginPass')).toBeVisible();
  await expect(page.locator('#loginBtn')).toBeVisible();
});

test('admin muestra título y enlace de volver', async ({ page }) => {
  await page.goto('/pages/admin.html');
  await expect(page.locator('h2')).toContainText('Artesanía Admin');
  await expect(page.locator('.login-back-link')).toContainText('Volver al sitio');
});

test('dashboard carga y muestra sidebar de admin', async ({ page }) => {
  const res = await page.goto('/pages/dashboard.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('.admin-sidebar')).toBeVisible();
  await expect(page.locator('#adminNav')).toBeVisible();
  await expect(page.locator('[data-section="products"]')).toBeVisible();
  await expect(page.locator('[data-section="orders"]')).toBeVisible();
});

test('dashboard muestra enlace de cerrar sesión', async ({ page }) => {
  await page.goto('/pages/dashboard.html');
  await expect(page.locator('#logoutBtn')).toBeVisible();
  await expect(page.locator('#logoutBtn')).toContainText('Cerrar sesión');
});
