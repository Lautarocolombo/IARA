const { test, expect } = require('@playwright/test');

test('success carga con datos de pedido', async ({ page }) => {
  await page.goto('/pages/success.html');
  await expect(page.locator('h1')).toContainText('Gracias por tu compra');
  await expect(page.locator('#transferCard')).toBeVisible();
  await expect(page.locator('#successTransferAlias')).toBeVisible();
});

test('success contiene botón de WhatsApp y subir comprobante', async ({ page }) => {
  await page.goto('/pages/success.html');
  await expect(page.locator('#successWhatsappBtn')).toBeVisible();
  await expect(page.locator('#successReceiptBtn')).toBeVisible();
});

test('contact carga con formulario', async ({ page }) => {
  const res = await page.goto('/pages/contact.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('form')).toBeVisible();
});

test('orders carga con tabla de pedidos', async ({ page }) => {
  const res = await page.goto('/pages/orders.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('.orders-container, .orders-list, table, #ordersList')).toBeVisible();
});
