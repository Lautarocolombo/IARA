const { test, expect } = require('@playwright/test');

test.describe('Checkout E2E', () => {
  test('flujo completo de compra con transferencia', async ({ page }) => {
    await page.goto('file://' + require('path').join(__dirname, '..', '..', 'frontend', 'pages', 'checkout.html'));

    await page.fill('#shipName', 'Cliente Test');
    await page.fill('#shipAddress', 'Calle Falsa 123');
    await page.fill('#shipZip', '3200');
    await page.fill('#shipCity', 'Gualeguay');
    await page.fill('#shipProvince', 'Entre Ríos');
    await page.fill('#shipPhone', '+5493444123456');
    await page.fill('#shipEmail', 'test@example.com');

    await page.click('#checkoutSubmitBtn');

    await expect(page.locator('#paymentInstructions')).toBeVisible();
    await expect(page.locator('#mpAliasValue')).toContainText('iara-salgueiro');

    const waHref = await page.locator('#whatsappComprobanteBtn').getAttribute('href');
    expect(waHref).toContain('wa.me');
    expect(waHref).toContain('Cliente%20Test');
    expect(waHref).toContain('Entre%20R%C3%ADos');
    expect(waHref).toContain('3200');
  });
});
