const { test, expect } = require('@playwright/test');

test('checkout carga y muestra el formulario de envío', async ({ page }) => {
  await page.goto('/pages/checkout.html');
  await page.evaluate(() => {
    localStorage.setItem('ag_cart', JSON.stringify([{ id: 236, name: 'Test Product', price: 100, qty: 1, emoji: '📿', image: '' }]));
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Finalizar compra');
  await expect(page.locator('#shippingForm')).toBeVisible({ timeout: 15000 });
});

test('checkout muestra estado vacío cuando no hay carrito', async ({ page }) => {
  await page.goto('/pages/checkout.html');
  await page.evaluate(() => localStorage.setItem('ag_cart', '[]'));
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#emptyCart')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#emptyCart h2')).toContainText('vacío');
});

test('checkout contiene breadcrumb y botón de volver', async ({ page }) => {
  await page.goto('/pages/checkout.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.breadcrumb')).toContainText('Checkout');
  await expect(page.locator('#navbar .nav-back')).toHaveCount(1);
});
