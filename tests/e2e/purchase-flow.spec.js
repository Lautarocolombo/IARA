const { test, expect } = require('@playwright/test');

test('flujo completo: catalogo -> carrito -> checkout -> orden -> success -> comprobante', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#productsGrid .product-card')).toHaveCount(4, { timeout: 15000 });

  const firstAddBtn = page.locator('#productsGrid .btn-add-cart').first();
  await firstAddBtn.click();
  await expect(page.locator('#cartCount')).toHaveText('1');

  await page.goto('/pages/checkout.html');
  await expect(page.locator('#shipName')).toBeVisible();

  await page.fill('#shipName', 'Juan Perez');
  await page.fill('#shipAddress', 'Calle Falsa 123');
  await page.fill('#shipZip', '2840');
  await page.fill('#shipCity', 'Gualeguay');
  await page.fill('#shipProvince', 'Entre Ríos');
  await page.fill('#shipPhone', '3444123456');
  await page.fill('#shipEmail', 'juan@example.com');

  const consent = page.locator('#checkoutConsent');
  if (await consent.count() > 0) {
    await consent.check();
  }

  await page.click('#checkoutSubmitBtn');
  await expect(page.locator('#paymentInstructions')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#paymentOrderId')).toHaveText(/#\d{4}/);

  const waBtn = page.locator('#whatsappComprobanteBtn');
  const waHref = await waBtn.getAttribute('href');
  expect(waHref).toContain('wa.me');
  expect(waHref).toContain(encodeURIComponent('Juan Perez'));

  await page.goto('/pages/success.html');
  await expect(page.locator('#successOrderNumber')).toHaveText(/#\d{4}/);

  const receiptBtn = page.locator('#successReceiptBtn');
  await receiptBtn.click();
  await expect(page.locator('#receiptModal')).toBeVisible();

  await page.setInputFiles('#receiptFile', {
    name: 'comprobante.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake-image-data')
  });
  await page.fill('#receiptHolderName', 'Juan Perez');
  await page.click('#receiptForm button[type="submit"]');
  await expect(page.locator('#receiptModal')).toBeHidden({ timeout: 10000 });
});
