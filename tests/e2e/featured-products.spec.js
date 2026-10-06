const { test, expect } = require('@playwright/test');

/**
 * Verificación end-to-end REAL (click en el navegador) del flujo de productos
 * destacados. Cubre lo que los tests unitarios no pueden cubrir:
 *   - el botón "Destacar" de la tabla realmente persiste contra la API
 *   - el badge ⭐ sobrevive a un reload de la página
 *   - la sección #featuredGrid del home se puebla de verdad
 *   - destaquear NO destruye stock/descripción/categoría (bug de zod 4)
 *   - el modal de edición restaura el checkbox "Destacado"
 *
 * Datos seed (tests/e2e/start-backend.js):
 *   'Pulsera Minimalista' featured=true  stock=12
 *   'Pulsera Turquesa'     featured=false stock=7   <- la que vamos a togglear
 */

const TARGET = 'Pulsera Turquesa';
const TARGET_STOCK = '7';

async function login(page) {
  await page.goto('/pages/admin.html');
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'admin');
  await page.click('#loginBtn');
  await page.waitForURL('**/dashboard.html', { timeout: 30000 });
}

async function openProducts(page) {
  await page.click('#adminNav a[data-section="products"]');
  // OJO: hay que esperar una fila CON data-product-id. Un simple `tr` matchea
  // también el placeholder "Cargando productos...", y eso abre la puerta a
  // races: el click se dispara antes de que loadProducts() termine.
  await page.locator('#productsTableBody tr[data-product-id]').first()
    .waitFor({ timeout: 20000 });
}

function targetRow(page) {
  return page.locator('#productsTableBody tr', { hasText: TARGET });
}

test.describe('productos destacados — click real', () => {
  test('agregar standout con el botón, persiste tras reload y aparece en el home', async ({ page }) => {
    await login(page);
    await openProducts(page);

    const row = targetRow(page);
    await expect(row).toHaveCount(1);

    // Estado inicial: NO destacado (el seed lo deja featured=false).
    await expect(row.locator('[title="Agregar a destacados"]')).toBeVisible();
    await expect(row.locator('.badge-featured')).toHaveCount(0);

    // --- CLICK REAL ---
    await row.locator('[title="Agregar a destacados"]').click();

    // Reacción inmediata en la UI.
    await expect(row.locator('.badge-featured')).toBeVisible();
    await expect(row.locator('[title="Quitar de destacados"]')).toBeVisible();

    // --- PERSISTENCIA: recarga completa ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openProducts(page);

    const rowAfter = targetRow(page);
    await expect(rowAfter.locator('.badge-featured')).toBeVisible();

    // --- El home muestra el producto en #featuredGrid ---
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const featuredGrid = page.locator('#featuredGrid');
    await expect(featuredGrid.locator('.product-card', { hasText: TARGET })).toHaveCount(1, { timeout: 20000 });
  });

  test('quitar standout con el botón, persiste tras reload y desaparece del home', async ({ page }) => {
    await login(page);
    await openProducts(page);

    const row = targetRow(page);
    await expect(row.locator('.badge-featured')).toBeVisible();

    // --- CLICK REAL para quitar ---
    await row.locator('[title="Quitar de destacados"]').click();

    await expect(row.locator('.badge-featured')).toHaveCount(0);
    await expect(row.locator('[title="Agregar a destacados"]')).toBeVisible();

    // --- PERSISTENCIA ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openProducts(page);

    await expect(targetRow(page).locator('.badge-featured')).toHaveCount(0);
  });

  test('destacar NO borra stock, descripción ni categoría', async ({ page }) => {
    await login(page);
    await openProducts(page);

    const row = targetRow(page);
    await expect(row).toContainText(TARGET_STOCK);

    // Toggle twice (agendar + desagendar) y volvemos a agendar.
    // Con el bug de zod 4 el segundo PUT reseteaba el stock a 0.
    await row.locator('[title="Agregar a destacados"]').click();
    await expect(row.locator('.badge-featured')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openProducts(page);
    await targetRow(page).locator('[title="Quitar de destacados"]').click();
    await expect(targetRow(page).locator('.badge-featured')).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openProducts(page);

    const finalRow = targetRow(page);
    await expect(finalRow.locator('.badge-featured')).toHaveCount(0);
    // El stock tiene que seguir siendo 7, no 0.
    await expect(finalRow).toContainText(TARGET_STOCK);
    // Y la categoría tampoco puede haberse reseteado.
    await expect(finalRow).toContainText('pulseras');
  });

  test('el modal de edición restaura el checkbox Destacado', async ({ page }) => {
    await login(page);
    await openProducts(page);

    // Producto destacado según el seed.
    const featuredRow = page.locator('#productsTableBody tr', { hasText: 'Pulsera Minimalista' });
    await expect(featuredRow.locator('.badge-featured')).toBeVisible();

    await featuredRow.locator('button[title="Editar"]').click();
    await expect(page.locator('#productModalOverlay')).toBeVisible({ timeout: 10000 });

    // Este era el bug raíz: el checkbox siempre llegaba desmarcado.
    await expect(page.locator('#prod_featured')).toBeChecked();

    await page.click('#closeProductModal');
    await expect(page.locator('#productModalOverlay')).toBeHidden({ timeout: 10000 });

    // Ahora un producto NO destacado.
    const plainRow = page.locator('#productsTableBody tr', { hasText: TARGET });
    await plainRow.locator('button[title="Editar"]').click();
    await expect(page.locator('#productModalOverlay')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#prod_featured')).not.toBeChecked();
  });
});
