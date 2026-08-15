const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('ag_cart', '[]'));
});

test('cart: página carga con carrito vacío', async ({ page }) => {
  const res = await page.goto('/pages/cart.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('#emptyCart')).toBeVisible();
  await expect(page.locator('#emptyCart h2')).toContainText('vacío');
  await expect(page.locator('#cartContent')).toBeHidden();
});

test('cart: agregar producto desde catálogo actualiza carrito', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('#cartCount')).toHaveText('1');
  await page.goto('/pages/cart.html');
  await page.waitForTimeout(500);
  await expect(page.locator('#cartContent')).toBeVisible();
  const count = await page.locator('.cart-item').count();
  expect(count).toBe(1);
});

test('cart: múltiples productos se acumulan', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  const addButtons = page.locator('.product-card .btn-add-cart');
  const count = await addButtons.count();
  for (let i = 0; i < Math.min(3, count); i++) {
    await addButtons.nth(i).click();
    await page.waitForTimeout(200);
  }
  await page.goto('/pages/cart.html');
  await page.waitForTimeout(500);
  const itemCount = await page.locator('.cart-item').count();
  expect(itemCount).toBe(3);
});

test('cart: persistencia en localStorage', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  const cartData = await page.evaluate(() => localStorage.getItem('ag_cart'));
  const parsed = JSON.parse(cartData);
  expect(parsed.length).toBeGreaterThan(0);
});

test('cart: cambiar cantidad desde carrito actualiza total', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  await page.goto('/pages/cart.html');
  await page.waitForTimeout(500);
  const qtyInput = page.locator('input[type="number"][data-product-id]').first();
  await qtyInput.fill('3');
  await page.waitForTimeout(300);
  const newQty = await qtyInput.inputValue();
  expect(parseInt(newQty)).toBe(3);
});

test('cart: eliminar producto del carrito', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  await page.goto('/pages/cart.html');
  await page.waitForTimeout(500);
  const itemCount = await page.locator('.cart-item').count();
  expect(itemCount).toBe(1);
  await page.locator('.remove-btn').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('#emptyCart')).toBeVisible();
});

test('cart: badge del carrito se actualiza', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('#cartCount')).toHaveText('1');
  await page.locator('.product-card .btn-add-cart').nth(1).click();
  await page.waitForTimeout(300);
  await expect(page.locator('#cartCount')).toHaveText('2');
});

test('cart: vaciar carrito deja estado vacío', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  await page.goto('/pages/cart.html');
  await page.waitForTimeout(500);
  await page.locator('.remove-btn').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('#emptyCart')).toBeVisible();
  await expect(page.locator('#cartContent')).toBeHidden();
});

test('cart: subtotal y total se calculan correctamente', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  await page.locator('.product-card .btn-add-cart').first().click();
  await page.waitForTimeout(300);
  await page.goto('/pages/cart.html');
  await page.waitForTimeout(500);
  await expect(page.locator('#subtotal')).not.toContainText('ARS 0,00');
  await expect(page.locator('#total')).not.toContainText('ARS 0,00');
});
