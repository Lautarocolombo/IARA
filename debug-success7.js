const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000/pages/success.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  const card = page.locator('#successCard');
  const children = card.locator('> *');
  const count = await children.count();
  console.log('Card children count:', count);
  for (let i = 0; i < count; i++) {
    const child = children.nth(i);
    const tag = await child.evaluate(el => el.tagName);
    const id = await child.getAttribute('id');
    const classes = await child.getAttribute('class');
    const style = await child.getAttribute('style');
    const height = await child.evaluate(el => el.offsetHeight);
    const width = await child.evaluate(el => el.offsetWidth);
    const display = await child.evaluate(el => getComputedStyle(el).display);
    console.log(`Child ${i}: tag=${tag}, id=${id}, class=${classes}, style=${style}, display=${display}, width=${width}, height=${height}`);
  }
  
  await browser.close();
})();