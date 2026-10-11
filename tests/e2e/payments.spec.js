const { test, expect } = require('@playwright/test');

test('success sin pedido muestra estado de recuperación', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('h1')).toContainText('Gracias por tu compra');
  // Wait for success.js module to execute and show fallback
  await expect(page.locator('#successFallback')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#orderInfo')).toBeHidden();
});

test('success con pedido muestra pago y comprobante', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1,
    number: '#0001',
    total: 1500,
    items: [{ name: 'Pulsera Test', price: 1500, qty: 1 }]
  })));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#successWhatsappBtn')).toBeVisible();
  await expect(page.locator('#successTransferAlias')).toBeVisible();
  await expect(page.locator('#transferCard')).toBeVisible();
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
