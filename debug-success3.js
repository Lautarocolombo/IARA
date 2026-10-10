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
  const children = fallback.locator('*');
  const count = await children.count();
  console.log('Child count:', count);
  for (let i = 0; i < count; i++) {
    const child = children.nth(i);
    const tag = await child.evaluate(el => el.tagName);
    const display = await child.evaluate(el => getComputedStyle(el).display);
    const width = await child.evaluate(el => el.offsetWidth);
    const height = await child.evaluate(el => el.offsetHeight);
    console.log(`Child ${i} (${tag}): display=${display}, width=${width}, height=${height}`);
  }
  await browser.close();
})();