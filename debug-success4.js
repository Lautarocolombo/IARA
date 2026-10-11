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
    const text = await child.textContent();
    const html = await child.evaluate(el => el.innerHTML);
    console.log(`Child ${i} (${tag}): text="${text}", html="${html}"`);
  }
  // Also check the fallback's innerHTML
  const fallbackHtml = await fallback.evaluate(el => el.innerHTML);
  console.log('Fallback innerHTML:', fallbackHtml);
  await browser.close();
})();