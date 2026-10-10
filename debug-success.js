const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000/pages/success.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const fallback = page.locator('#successFallback');
  console.log('Fallback visible:', await fallback.isVisible());
  console.log('Fallback display:', await fallback.evaluate(el => getComputedStyle(el).display));
  const orderInfo = page.locator('#orderInfo');
  console.log('OrderInfo visible:', await orderInfo.isVisible());
  console.log('OrderInfo display:', await orderInfo.evaluate(el => getComputedStyle(el).display));
  await browser.close();
})();