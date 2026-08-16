/* eslint-disable no-unused-vars, no-empty */
const { test } = require('@playwright/test');

test('debug: price filter exact', async ({ page }) => {
  await page.goto('/#catalog');
  await page.reload();
  await page.waitForTimeout(1000);
  
  const beforeCount = await page.locator('.product-card').count();
  
  for (let i = 0; i < Math.min(beforeCount, 3); i++) {
    const priceText = await page.locator('.product-price').nth(i).textContent();
    const name = await page.locator('.product-name').nth(i).textContent();
  }
  
  page.on('request', req => {
    if (req.url().includes('/api/products')) {
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/products')) {
    }
  });
  
  await page.fill('#minPrice', '500');
  await page.waitForTimeout(1500);
  
  const afterCount = await page.locator('.product-card').count();
  
  for (let i = 0; i < Math.min(afterCount, 3); i++) {
    const priceText = await page.locator('.product-price').nth(i).textContent();
    const name = await page.locator('.product-name').nth(i).textContent();
    const price = parseFloat(priceText.replace(/[^0-9,]/g, '').replace(',', '.'));
  }
});
