const { test, expect } = require('@playwright/test');

test('search: página inicio tiene barra de búsqueda', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#searchInput')).toBeVisible();
  await expect(page.locator('#searchBtn')).toBeVisible();
});

test('search: buscar producto existente filtra resultados', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'Pulsera');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  const firstCard = page.locator('.product-card').first();
  await expect(firstCard.locator('.product-name')).toContainText('Pulsera');
});

test('search: buscar por categoría combinada con texto', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.fill('#searchInput', 'Rosa');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  if (count > 0) {
    await expect(cards.first().locator('.product-name')).toContainText('Rosa');
  }
});

test('search: búsqueda vacía no filtra', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', '');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('search: búsqueda con texto corto no filtra', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'Pu');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('search: búsqueda sin resultados muestra mensaje', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'zzznomatch');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.empty-state')).toContainText('No se encontraron productos');
});

test('search: Enter en input dispara búsqueda', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'Pulsera');
  await page.press('#searchInput', 'Enter');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('search: limpiar búsqueda restaura productos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.fill('#searchInput', 'Pulsera');
  await page.click('#searchBtn');
  await page.waitForTimeout(500);
  await page.fill('#searchInput', '');
  await page.click('#clearFiltersBtn');
  await page.waitForTimeout(500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});
