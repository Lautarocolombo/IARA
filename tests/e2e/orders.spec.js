const { test, expect } = require('@playwright/test');

test('orders: página carga con formulario de búsqueda', async ({ page }) => {
  const res = await page.goto('/pages/orders.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('#orderLookupForm')).toBeVisible();
  await expect(page.locator('#orderEmail')).toBeVisible();
  await expect(page.locator('#orderLookupForm .btn-primary')).toContainText('Buscar pedidos');
});

test('orders: búsqueda sin email no envía formulario', async ({ page }) => {
  await page.goto('/pages/orders.html');
  await page.click('#orderLookupForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#ordersContainer')).toBeHidden();
});

test('orders: búsqueda con email inválido no envía', async ({ page }) => {
  await page.goto('/pages/orders.html');
  await page.fill('#orderEmail', 'invalido');
  await page.click('#orderLookupForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#ordersContainer')).toBeHidden();
});

test('orders: muestra estado vacío cuando no hay pedidos', async ({ page }) => {
  await page.goto('/pages/orders.html');
  await page.fill('#orderEmail', 'test-no-existe@example.com');
  await page.click('#orderLookupForm .btn-primary');
  await page.waitForTimeout(1500);
  await expect(page.locator('#ordersContainer')).toBeVisible();
  await expect(page.locator('.empty-orders h2')).toContainText('No tenés pedidos');
});

test('orders: breadcrumb y enlace de volver', async ({ page }) => {
  await page.goto('/pages/orders.html');
  await expect(page.locator('.breadcrumb')).toContainText('Mis Pedidos');
  await expect(page.locator('.back-link')).toContainText('Volver al sitio');
});

test('tracking: página carga con formulario de búsqueda', async ({ page }) => {
  const res = await page.goto('/pages/tracking.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('#trackingLookupForm')).toBeVisible();
  await expect(page.locator('#trackingOrderId')).toBeVisible();
});

test('tracking: búsqueda con id inexistente muestra fallback', async ({ page }) => {
  await page.goto('/pages/tracking.html');
  await page.fill('#trackingOrderId', '999999');
  await page.click('#trackingLookupForm .btn-primary');
  await page.waitForTimeout(1500);
  await expect(page.locator('#trackingFallback')).toBeVisible();
  await expect(page.locator('#trackingFallback h2')).toContainText('Pedido no encontrado');
});

test('tracking: breadcrumb y enlace de volver', async ({ page }) => {
  await page.goto('/pages/tracking.html');
  await expect(page.locator('.breadcrumb')).toContainText('Seguimiento');
  await expect(page.locator('.back-link')).toContainText('Volver al sitio');
});
