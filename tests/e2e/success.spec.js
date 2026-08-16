const { test, expect } = require('@playwright/test');

test('success: página carga con encabezado', async ({ page }) => {
  const res = await page.goto('/pages/success.html');
  expect(res.status()).toBe(200);
  await expect(page.locator('#successCard')).toBeVisible();
  await expect(page.locator('#successCard h1')).toContainText('Gracias por tu compra');
});

test('success: muestra información de transferencia', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#transferCard')).toBeVisible();
  await expect(page.locator('#successTransferAlias')).toBeVisible();
  await expect(page.locator('#successTransferTotal')).toBeVisible();
});

test('success: muestra botón de WhatsApp', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#successWhatsappBtn')).toBeVisible();
  await expect(page.locator('#successWhatsappBtn')).toHaveAttribute('href', /wa\.me/);
});

test('success: muestra botón de subir comprobante', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#successReceiptBtn')).toBeVisible();
});

test('success: botón subir comprobante abre modal', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#successReceiptBtn');
  await expect(page.locator('#receiptModal')).toBeVisible();
  await expect(page.locator('#receiptModal h3')).toContainText('Subir comprobante');
});

test('success: modal tiene formulario de comprobante', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#successReceiptBtn');
  await expect(page.locator('#receiptForm')).toBeVisible();
  await expect(page.locator('#receiptHolderName')).toBeVisible();
  await expect(page.locator('#receiptFile')).toBeVisible();
  await expect(page.locator('#receiptForm .btn-primary')).toContainText('Enviar comprobante');
});

test('success: modal se cierra con botón cancelar', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#successReceiptBtn');
  await expect(page.locator('#receiptModal')).toBeVisible();
  await page.click('[data-action="close-receipt-modal"]');
  await expect(page.locator('#receiptModal')).toBeHidden();
});

test('success: copiar alias funciona', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.setItem('ag_last_order', JSON.stringify({
    id: 1, number: 'TEST-001', total: 1500,
    items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
    shippingName: 'Test', shippingAddress: 'Calle Test', shippingCity: 'Gualeguay', shippingPhone: '+5491234567890'
  })));
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#successTransferAlias')).toHaveText(/.+/);
  await expect(page.locator('#copySuccessAliasBtn')).toBeVisible();
  await page.click('#copySuccessAliasBtn');
  await expect(page.locator('#copySuccessAliasBtn')).toContainText('Copiado');
});

test('success: sin datos de pedido muestra fallback', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => sessionStorage.removeItem('ag_last_order'));
  await page.reload();
  await expect(page.locator('#successFallback')).toBeVisible();
  await expect(page.locator('#successFallback')).toContainText('No se encontró información del pedido');
});

test('success: resumen de pedido está presente cuando hay datos', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => {
    sessionStorage.setItem('ag_last_order', JSON.stringify({
      id: 1,
      number: 'TEST-001',
      total: 1500,
      items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }],
      shippingName: 'Test User',
      shippingAddress: 'Calle Test 123',
      shippingCity: 'Gualeguay',
      shippingPhone: '+5491234567890'
    }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#successOrderNumber')).toContainText('TEST-001');
  await expect(page.locator('#successTransferTotal')).toContainText('1.500');
  await expect(page.locator('#successSummaryItems')).toBeVisible();
});

test('success: badge de estado se muestra', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => {
    sessionStorage.setItem('ag_last_order', JSON.stringify({
      id: 1,
      number: 'TEST-001',
      total: 1500,
      items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }]
    }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#successStatusBadge')).toBeVisible();
  await expect(page.locator('#successStatusBadge')).toContainText('Esperando Comprobante');
});

test('success: botón de tracking presente cuando hay order id', async ({ page }) => {
  await page.goto('/pages/success.html');
  await page.evaluate(() => {
    sessionStorage.setItem('ag_last_order', JSON.stringify({
      id: 42,
      number: 'TEST-042',
      total: 1500,
      items: [{ name: 'Pulsera Test', qty: 1, price: 1500 }]
    }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#trackingBtn')).toBeVisible();
  await expect(page.locator('#trackingBtn')).toHaveAttribute('href', /tracking\.html\?orderId=42/);
});
