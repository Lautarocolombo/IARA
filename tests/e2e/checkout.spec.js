const { test, expect } = require('@playwright/test');

test('checkout carga y muestra el formulario de envío', async ({ page }) => {
  const res = await page.goto('/pages/checkout.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('Finalizar compra');
  await expect(page.locator('#shipName')).toBeVisible();
  await expect(page.locator('#shipAddress')).toBeVisible();
  await expect(page.locator('#shippingForm')).toBeVisible();
});

test('checkout muestra estado vacío cuando no hay carrito', async ({ page }) => {
  await page.goto('/pages/checkout.html');
  await page.evaluate(() => localStorage.setItem('cart', '[]'));
  await page.reload();
  await expect(page.locator('#emptyCart')).toBeVisible();
  await expect(page.locator('#emptyCart h2')).toContainText('vacío');
});

test('checkout contiene breadcrumb y botón de volver', async ({ page }) => {
  await page.goto('/pages/checkout.html');
  await expect(page.locator('.breadcrumb')).toContainText('Checkout');
  await expect(page.locator('.nav-back')).toHaveCount(1);
});
