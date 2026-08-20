const { test, expect } = require('@playwright/test');

test('contact: página carga con formulario completo', async ({ page }) => {
  const res = await page.goto('/pages/contact.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('#contactForm')).toBeVisible();
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#message')).toBeVisible();
  await expect(page.locator('#contactForm .btn-primary')).toContainText('Enviar Mensaje');
});

test('contact: formulario vacío no envía', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.click('#contactForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#name')).toHaveValue('');
});

test('contact: email inválido no envía', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.fill('#name', 'Test');
  await page.fill('#email', 'invalido');
  await page.fill('#message', 'Mensaje de prueba');
  await page.click('#contactForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#name')).toHaveValue('Test');
});

test('contact: formulario válido muestra toast de éxito', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.fill('#name', 'Test User');
  await page.fill('#email', 'test@example.com');
  await page.fill('#message', 'Mensaje de prueba desde Playwright');
  await page.click('#contactForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#toastContainer .toast')).toContainText('Mensaje enviado con éxito');
});

test('contact: después de envío exitoso el formulario se limpia', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await page.fill('#name', 'Test User');
  await page.fill('#email', 'test@example.com');
  await page.fill('#message', 'Mensaje de prueba desde Playwright');
  await page.click('#contactForm .btn-primary');
  await page.waitForTimeout(500);
  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#email')).toHaveValue('');
  await expect(page.locator('#message')).toHaveValue('');
});

test('contact: muestra información de contacto', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await expect(page.locator('.contact-info')).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toContainText('+54 (3444) 634-4444');
  await expect(page.locator('a[href^="mailto:"]')).toContainText('CONFIGURAR_EMAIL');
});

test('contact: mapa está presente', async ({ page }) => {
  await page.goto('/pages/contact.html');
  await expect(page.locator('.map-wrapper')).toBeVisible();
  await expect(page.locator('iframe.map-iframe-sm, iframe.map-iframe')).toHaveCount(1);
});

test('contact: botón de WhatsApp presente', async ({ page }) => {
  await page.goto('/pages/contact.html');
  const waBtn = page.locator('.whatsapp-cta .btn-primary');
  await waBtn.scrollIntoViewIfNeeded();
  await expect(waBtn).toBeVisible();
  await expect(waBtn).toHaveAttribute('href', /wa\.me/);
});
