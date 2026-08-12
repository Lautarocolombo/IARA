const { test, expect } = require('@playwright/test');

const MENU_TEXTS = ['Inicio', 'Catálogo', 'Sobre Nosotros', 'Contacto'];

const NON_HOME = [
  '/pages/cart.html',
  '/pages/checkout.html',
  '/pages/product.html',
  '/pages/orders.html',
  '/pages/contact.html',
  '/pages/wishlist.html',
  '/pages/faq.html',
  '/pages/privacy.html',
  '/pages/terms.html',
  '/pages/success.html',
  '/pages/404.html',
  '/pages/pulsera.html',
];

test('Home renderiza el menú completo y no el botón volver', async ({ page }) => {
  const res = await page.goto('/');
  expect(res.status()).toBe(200);
  const nav = page.locator('nav.navbar');
  await expect(nav).toContainText('Artesanía Gualeguay');
  await Promise.all(MENU_TEXTS.map((label) => expect(nav).toContainText(label)));
  await expect(nav.locator('.navbar-menu')).toContainText('Contacto');
  await expect(page.locator('.nav-back')).toHaveCount(0);
  await expect(page.locator('#themeToggle')).toHaveCount(1);
  await expect(page.locator('#cartCount')).toHaveCount(1);
});

for (const rel of NON_HOME) {
  test(`Página ${rel}: muestra "← Volver al inicio" y omite el menú`, async ({ page }) => {
    const res = await page.goto(rel);
    expect(res.status()).toBe(200);
    const nav = page.locator('nav.navbar');
    await expect(nav).toContainText('Artesanía Gualeguay');
    await expect(nav).toContainText('Volver al inicio');
    await expect(nav.locator('.nav-back')).toHaveCount(1);
    await expect(nav.locator('.navbar-menu')).toHaveCount(0);
    await expect(nav.locator('.nav-link')).toHaveCount(0);
    await expect(page.locator('#themeToggle')).toHaveCount(1);
    await expect(page.locator('#cartCount')).toHaveCount(1);
  });
}

test('El enlace del carrito y el volver resuelven sin ruta rota (HTTP 200)', async ({ page }) => {
  let res = await page.goto('/pages/cart.html');
  expect(res.status()).toBe(200);
  res = await page.goto('/');
  expect(res.status()).toBe(200);
});
