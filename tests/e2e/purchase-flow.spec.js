const { test, expect } = require('@playwright/test');

test('checkout muestra formulario y resumen del pedido', async ({ page }) => {
  await page.goto('/pages/checkout.html');
  await page.evaluate(() => localStorage.setItem('ag_cart', JSON.stringify([
    { id: 236, name: 'Test Product', price: 100, qty: 1, emoji: '📿', image: '' }
  ])));
  await page.reload();
  await page.waitForTimeout(1000);

  await expect(page.locator('h1')).toContainText('Finalizar compra');
  await expect(page.locator('#shipName')).toBeVisible();
  await expect(page.locator('#shipAddress')).toBeVisible();
  await expect(page.locator('#paymentMethod')).toBeVisible();
});

test('checkout crea pedido con transferencia', async ({ page }) => {
  await page.addInitScript(() => {
    window.CONFIG = {
      API: { BASE: 'http://localhost:3000' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15, TRANSITION_SPEED: 0.4 },
      CART: { STORAGE_KEY: 'ag_cart', SHIPPING_COST: 200, SHIPPING_THRESHOLD: 2000, FREE_SHIPPING_TEXT: 'Envío Gratis' },
      CONTACT: { WHATSAPP: '+5493444634444', WHATSAPP_ALIAS: 'iara-salgueiro', PHONE: '+54 (3444) 634-4444', EMAIL: 'noreply@artesaniagualeguay.com', ADDRESS: 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina', COORDINATES: { lat: -33.1400009, lng: -59.3136349 }, GOOGLE_MAPS_API_KEY: '' }
    };
    window.getAuthToken = () => 'fake-token';
    window.fetchWithRetry = async (url, options = {}) => {
      const res = await fetch(url, options);
      return { ok: res.ok, status: res.status, json: async () => res.json() };
    };
    window.emitSync = () => {};
    window.startDataSync = () => {};
    window.onSyncMessage = () => {};
    window.formatARS = (value) => {
      const number = typeof value === 'number' ? value : parseFloat(value) || 0;
      return '$ ' + number.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    window.showToast = () => {};
    window.loadMpAlias = async () => ({ active: true, transferAlias: 'artesaniagualeguay', holderName: 'Artesanía Gualeguay', whatsapp: '5493444634444', message: 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.' });
    window.copyTransferField = () => {};
    window.copyMpAlias = () => {};
    window.renderProductImage = () => '';
    window.fetchProducts = async () => {};
  });

  await page.goto('/pages/checkout.html');
  await page.evaluate(() => localStorage.setItem('ag_cart', JSON.stringify([
    { id: 236, name: 'Test Product', price: 100, qty: 1, emoji: '📿', image: '' }
  ])));
  await page.reload();
  await page.waitForTimeout(1000);

  await page.fill('#shipName', 'Juan Perez');
  await page.fill('#shipAddress', 'Calle Falsa 123');
  await page.fill('#shipCity', 'Gualeguay');
  await page.selectOption('#shipProvince', 'Entre Ríos');
  await page.fill('#shipZip', '2840');
  await page.fill('#shipPhone', '3444634444');
  await page.fill('#shipEmail', 'juan@test.com');

  await page.check('#checkoutConsent');

  await page.selectOption('#paymentMethod', 'transfer');

  await page.route('/api/orders', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 999, order_token: 'test-token-123' }),
    });
  });

  await page.route('/api/payment-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        active: true,
        transferAlias: 'artesaniagualeguay',
        holderName: 'Artesanía Gualeguay',
        whatsapp: '5493444634444',
        message: 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.'
      }),
    });
  });

  await page.click('#checkoutSubmitBtn');

  await expect(page.locator('#paymentInstructions')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#paymentOrderId')).not.toContainText('--');
});
