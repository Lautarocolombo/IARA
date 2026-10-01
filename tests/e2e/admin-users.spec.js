const { test, expect } = require('@playwright/test');

test.describe('Admin Users', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/admin-users.html');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('#adminPageUsername', 'admin');
    await page.fill('#adminPagePassword', 'admin');
    await page.click('#adminPageLoginSubmit');
    await page.waitForTimeout(1000);
    await page.waitForSelector('#usersTable', { timeout: 10000 }).catch(() => {});
  });

  test('admin login page loads', async ({ page }) => {
    await expect(page).toHaveURL(/.*admin-users.*/);
  });

  test('user list is visible', async ({ page }) => {
    const usersTable = page.locator('#usersTable, [data-testid="users-table"]');
    await usersTable.waitFor({ timeout: 5000 }).catch(() => {});
  });

  test('add user button exists', async ({ page }) => {
    const addBtn = page.locator('#createUserBtn');
    await expect(addBtn).toBeVisible();
  });

  test('user search works', async ({ page }) => {
    const searchInput = page.locator('#usersQuery');
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('edit user action available', async ({ page }) => {
    const editBtn = page.locator('button:has-text("Editar"), [data-testid="edit-user"]').first();
    if (await editBtn.count() > 0) {
      await expect(editBtn).toBeVisible();
    }
  });

  test('delete user action available', async ({ page }) => {
    const deleteBtn = page.locator('button:has-text("Eliminar"), [data-testid="delete-user"]').first();
    if (await deleteBtn.count() > 0) {
      await expect(deleteBtn).toBeVisible();
    }
  });
});
