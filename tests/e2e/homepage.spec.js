const { test, expect } = require('@playwright/test');
const path = require('path');

test('homepage carga correctamente', async ({ page }) => {
  await page.goto('file://' + path.join(__dirname, '..', '..', 'frontend', 'index.html'));
  await expect(page.locator('h1')).toContainText('Regalos');
});
