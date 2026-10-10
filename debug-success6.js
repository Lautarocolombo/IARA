const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000/pages/success.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  const p = page.locator('#successFallback p');
  const pStyles = await p.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      height: cs.height,
      margin: cs.margin,
      padding: cs.padding,
    };
  });
  console.log('P styles:', JSON.stringify(pStyles, null, 2));
  
  const a1 = page.locator('#successFallback a').first();
  const a1Styles = await a1.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      height: cs.height,
      width: cs.width,
    };
  });
  console.log('A1 styles:', JSON.stringify(a1Styles, null, 2));
  
  // Check if the elements are in the DOM tree correctly
  const fallback = page.locator('#successFallback');
  const parent = await fallback.evaluate(el => el.parentElement?.tagName);
  console.log('Fallback parent:', parent);
  
  const children = await fallback.evaluate(el => Array.from(el.children).map(c => c.tagName));
  console.log('Fallback children:', children);
  
  await browser.close();
})();