const { test, expect } = require('@playwright/test');

test('categories: página inicio tiene botones de filtro', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.filter-btn[data-filter="all"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.filter-btn[data-filter="pulseras"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.filter-btn[data-filter="accesorios"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.filter-btn[data-filter="souvenirs"]')).toBeVisible({ timeout: 15000 });
});

test('categories: filtro Todos activo por defecto', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveClass(/active/, { timeout: 15000 });
});

test('categories: click en Pulseras filtra productos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('.filter-btn[data-filter="pulseras"]')).toHaveClass(/active/, { timeout: 15000 });
});

test('categories: cambiar de categoría actualiza vista', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  const pulserasCount = await page.locator('.product-card').count();
  await page.locator('.filter-btn[data-filter="accesorios"]').click();
  await page.waitForTimeout(1500);
  const accesoriosCount = await page.locator('.product-card').count();
  expect(pulserasCount).not.toBe(accesoriosCount);
});

test('categories: botón limpiar restaura Todos', async ({ page }) => {
  await page.goto('/#catalog');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.locator('.filter-btn[data-filter="pulseras"]').click();
  await page.waitForTimeout(1500);
  await page.click('#clearFiltersBtn');
  await page.waitForTimeout(1500);
  await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveClass(/active/, { timeout: 15000 });
  const count = await page.locator('.product-card').count();
  expect(count).toBeGreaterThan(0);
});
