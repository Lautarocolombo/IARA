const { test, expect } = require('@playwright/test');

test('inventory section renders in dashboard after login', async ({ page }) => {
  await page.goto('/pages/admin.html');
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'admin');
  await page.click('#loginBtn');
  await page.waitForURL('**/dashboard.html');
  await page.waitForTimeout(1000);

  await page.click('[data-section="inventory"]');
  await page.waitForTimeout(500);

  await expect(page.locator('#section-inventory')).toBeVisible();
  await expect(page.locator('#inventoryMovementsBody')).toBeVisible();
  await expect(page.locator('#inventoryAlertsBody')).toBeVisible();
  await expect(page.locator('#refreshInventoryBtn')).toBeVisible();
  await expect(page.locator('#refreshAlertsBtn')).toBeVisible();
});

test('inventory sidebar link exists after login', async ({ page }) => {
  await page.goto('/pages/admin.html');
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'admin');
  await page.click('#loginBtn');
  await page.waitForURL('**/dashboard.html');
  await page.waitForTimeout(1000);

  await expect(page.locator('[data-section="inventory"]')).toBeVisible();
  await expect(page.locator('[data-section="inventory"] span:last-child')).toContainText('Inventario');
});
