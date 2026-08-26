const { test, expect } = require('@playwright/test');

test('categories: página inicio tiene botones de filtro', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.filter-btn[data-filter="all"]')).toBeVisible();
  await expect(page.locator('.filter-btn[data-filter="pulseras"]')).toBeVisible();
  await expect(page.locator('.filter-btn[data-filter="accesorios"]')).toBeVisible();
  await expect(page.locator('.filter-btn[data-filter="souvenirs"]')).toBeVisible();
});

test('categories: filtro Todos activo por defecto', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveClass(/active/);
});

test('categories: click en Pulseras filtra productos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('.filter-btn[data-filter="pulseras"]')).toHaveClass(/active/);
});

test('categories: click en Accesorios filtra productos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="accesorios"]').click();
  await page.waitForTimeout(1500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('.filter-btn[data-filter="accesorios"]')).toHaveClass(/active/);
});

test('categories: click en Souvenirs filtra productos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="souvenirs"]').click();
  await page.waitForTimeout(1500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('.filter-btn[data-filter="souvenirs"]')).toHaveClass(/active/);
});

test('categories: cambiar de categoría actualiza vista', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  const pulserasCount = await page.locator('.product-card').count();
  await page.locator('.filter-btn[data-filter="accesorios"]').click();
  await page.waitForTimeout(1500);
  const accesoriosCount = await page.locator('.product-card').count();
  expect(pulserasCount).not.toBe(accesoriosCount);
});

test('categories: productos filtrados muestran categoría correcta', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toHaveClass(/cat-pulseras/);
  }
});

test('categories: botón limpiar restaura Todos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  await page.click('#clearFiltersBtn');
  await page.waitForTimeout(1500);
  await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveClass(/active/);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});

test('categories: filtro de precio mínimo', async ({ page }) => {
  await page.goto('/#catalog');
  await page.reload();
  await page.waitForTimeout(1000);
  await page.fill('#minPrice', '500');
  await page.waitForTimeout(1500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const priceText = await cards.nth(i).locator('.product-price').textContent();
      const price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
      expect(price).toBeGreaterThanOrEqual(500);
    }
  }
});

test('categories: filtro de precio máximo', async ({ page }) => {
  await page.goto('/#catalog');
  await page.reload();
  await page.waitForTimeout(1000);
  await page.fill('#maxPrice', '300');
  await page.waitForTimeout(1500);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const priceText = await cards.nth(i).locator('.product-price').textContent();
      const price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
      expect(price).toBeLessThanOrEqual(300);
    }
  }
});
