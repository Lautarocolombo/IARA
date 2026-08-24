const { test, expect } = require('@playwright/test');

test('contact: página carga con formulario completo', async ({ page }) => {
  const res = await page.goto('/pages/contact.html');
  expect(res.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#contactForm')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#name')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#message')).toBeVisible({ timeout: 15000 });
});

test('contact: formulario vacío no envía', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.waitForLoadState('networkidle');
  await page.click('#contactForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#name')).toHaveValue('');
});

test('contact: muestra información de contacto', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.contact-info')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('a[href^="tel:"]')).toContainText('+54 (3444) 634-4444');
});

test('contact: mapa está presente', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.map-wrapper')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('iframe.map-iframe-sm, iframe.map-iframe')).toHaveCount(1);
});
