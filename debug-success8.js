const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000/pages/success.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  // Check if successFallback exists in DOM
  const fallback = page.locator('#successFallback');
  console.log('Fallback exists:', await fallback.count() > 0);
  
  // Check parent
  const parent = await fallback.evaluate(el => el.parentElement?.id);
  console.log('Fallback parent ID:', parent);
  
  // Check all elements with id successFallback
  const all = await page.locator('[id="successFallback"]').count();
  console.log('All successFallback elements:', all);
  
  // Check the card's innerHTML
  const card = page.locator('#successCard');
  const innerHTML = await card.evaluate(el => el.innerHTML);
  console.log('Card innerHTML length:', innerHTML.length);
  console.log('Card innerHTML contains successFallback:', innerHTML.includes('successFallback'));
  
  await browser.close();
})();