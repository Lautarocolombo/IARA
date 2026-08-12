const { test, expect } = require('@playwright/test');

test('homepage carga correctamente', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Regalos');
});
