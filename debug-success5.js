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
  const styles = await fallback.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      opacity: cs.opacity,
      visibility: cs.visibility,
      position: cs.position,
      width: cs.width,
      height: cs.height,
      minWidth: cs.minWidth,
      minHeight: cs.minHeight,
      maxWidth: cs.maxWidth,
      maxHeight: cs.maxHeight,
      overflow: cs.overflow,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      boxSizing: cs.boxSizing,
      margin: cs.margin,
      padding: cs.padding,
      border: cs.border,
      flex: cs.flex,
      grid: cs.grid,
    };
  });
  console.log('Fallback computed styles:', JSON.stringify(styles, null, 2));
  
  // Check parent
  const card = page.locator('#successCard');
  const cardStyles = await card.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      width: cs.width,
      height: cs.height,
      overflow: cs.overflow,
      flexDirection: cs.flexDirection,
      gridTemplateColumns: cs.gridTemplateColumns,
    };
  });
  console.log('Card computed styles:', JSON.stringify(cardStyles, null, 2));
  
  await browser.close();
})();