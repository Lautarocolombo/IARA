const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('request', req => console.log('REQUEST:', req.method(), req.url()));
  page.on('response', res => console.log('RESPONSE:', res.status(), res.url()));
  await page.goto('http://localhost:3000/#catalog');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  console.log('--- Clicking souvenirs filter ---');
  const btn = page.locator('.filter-btn[data-filter="souvenirs"]');
  console.log('Button visible:', await btn.isVisible());
  console.log('Button enabled:', await btn.isEnabled());
  await btn.click();
  await page.waitForTimeout(3000);
  const count = await page.locator('.product-card').count();
  console.log('Product count:', count);
  for (let i = 0; i < count; i++) {
    const cls = await page.locator('.product-card').nth(i).getAttribute('class');
    console.log('Product', i, 'class:', cls);
  }
  await browser.close();
})();