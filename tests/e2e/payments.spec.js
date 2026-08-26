const { test, expect } = require('@playwright/test');

const sampleOrder = {
  id: 999,
  number: 'IARA-999',
  total: 5000,
  shippingCost: 500,
  items: [
    { name: 'Pulsera Test', price: 2500, qty: 2 }
  ],
  shippingName: 'Juan Pérez',
  shippingAddress: 'Calle Falsa 123',
  shippingCity: 'Gualeguay',
  shippingPhone: '5493444634444',
  waNumber: '5493444634444',
  waMsg: 'Hola! Quiero confirmar mi pago y enviar mi comprobante de transferencia.',
  orderToken: 'test-token-123'
};

test('success carga con datos de pedido', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate((order) => sessionStorage.setItem('ag_last_order', JSON.stringify(order)), sampleOrder);
  await page.reload();
  await expect(page.locator('h1')).toContainText('Gracias por tu compra');
  await expect(page.locator('#transferCard')).toBeVisible();
  await expect(page.locator('#successTransferAlias')).toBeVisible();
});

test('success contiene botón de WhatsApp y subir comprobante', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate((order) => sessionStorage.setItem('ag_last_order', JSON.stringify(order)), sampleOrder);
  await page.reload();
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
