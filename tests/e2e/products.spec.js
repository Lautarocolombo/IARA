const { test, expect } = require('@playwright/test');

test('products: catálogo carga con grid de productos', async ({ page }) => {
  const res = await page.goto('/#catalog');
  expect(res.status()).toBe(200);
  await expect(page.locator('#productsGrid')).toBeVisible();
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('products: filtro por categoría pulseras muestra solo pulseras', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toHaveClass(/cat-pulseras/);
  }
});

test('products: filtro por categoría accesorios muestra solo accesorios', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="accesorios"]').click();
  await page.waitForTimeout(500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toHaveClass(/cat-accesorios/);
  }
});

test('products: filtro por categoría souvenirs muestra solo souvenirs', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="souvenirs"]').click();
  await page.waitForTimeout(500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toHaveClass(/cat-souvenirs/);
  }
});

test('products: filtro Todos muestra todos los productos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="all"]').click();
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('products: búsqueda filtra productos por nombre', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'Pulsera');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  const firstCard = page.locator('.product-card').first();
  await expect(firstCard.locator('.product-name')).toContainText('Pulsera');
});

test('products: búsqueda con menos de 2 caracteres no filtra', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'P');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('products: búsqueda sin resultados muestra estado vacío', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'zzzzzzznomatch');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.empty-state')).toContainText('No se encontraron productos');
});

test('products: limpiar filtros restaura estado completo', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.fill('#searchInput', 'Pulsera');
  await page.click('#clearFiltersBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('#searchInput')).toHaveValue('');
});

test('products: detalle de producto carga información', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  const firstCard = page.locator('.product-card').first();
  const productLink = firstCard.locator('a[href*="product.html"]').first();
  const href = await productLink.getAttribute('href');
  await page.goto(href);
  await expect(page.locator('.product-detail-title')).toBeVisible();
  await expect(page.locator('.product-detail-price')).toBeVisible();
  await expect(page.locator('.product-detail-desc')).toBeVisible();
  await expect(page.locator('.btn-add-cart')).toBeVisible();
});

test('products: detalle de producto sin id muestra error', async ({ page }) => {
  await page.goto('/pages/product.html');
  await expect(page.locator('#productContent')).toContainText('Producto no encontrado');
});

test('products: botón agregar al carrito desde detalle', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForTimeout(500);
  const firstCard = page.locator('.product-card').first();
  const productLink = firstCard.locator('a[href*="product.html"]').first();
  const href = await productLink.getAttribute('href');
  await page.goto(href);
  await page.waitForTimeout(500);
  await page.click('.btn-add-cart');
  await expect(page.locator('#toastContainer .toast')).toContainText('agregado al carrito');
});
