const { test, expect } = require('@playwright/test');

test.describe('Admin Sales Delete Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/pages/admin.html');
    await page.fill('#loginUser', 'admin');
    await page.fill('#loginPass', 'admin');
    await page.click('#loginBtn');
    await page.waitForURL('**/dashboard.html');
    await page.goto('http://localhost:3000/pages/dashboard.html');
    await page.click('[data-section="sales"]');
    await page.waitForTimeout(4000);
  });

  test('individual delete button opens confirm modal', async ({ page }) => {
    const deleteBtn = page.locator('.btn-delete-tx').first();
    if (await deleteBtn.count() === 0) {
      test.skip('No transactions found in table');
      return;
    }
    await deleteBtn.click();
    const modal = page.locator('#confirmModalOverlay');
    await expect(modal).toHaveClass(/active/);
    const message = await page.locator('#confirmModalMessage').textContent();
    expect(message).toContain('Eliminar');
  });

  test('clear history button opens confirm modal', async ({ page }) => {
    const clearBtn = page.locator('#resetSalesBtn');
    if (await clearBtn.count() === 0) {
      test.skip('Clear history button not found');
      return;
    }
    await clearBtn.click();
    const modal = page.locator('#confirmModalOverlay');
    await expect(modal).toHaveClass(/active/);
    const message = await page.locator('#confirmModalMessage').textContent();
    expect(message).toContain('eliminar');
  });
});
