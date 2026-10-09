const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleMessages = [];
  const failedRequests = [];
  
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  
  page.on('requestfailed', request => {
    failedRequests.push({ url: request.url(), failure: request.failure() });
  });
  
  page.on('response', response => {
    if (response.url().includes('/imagenes/carrucel/') || response.url().includes('/api/carousel/')) {
      console.log(`Response: ${response.url()} - ${response.status()} - ${response.headers()['content-type']}`);
    }
  });

  try {
    await page.goto('https://artesania-gualeguay-v3.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    // Check carousel images
    const carouselImages = await page.locator('.about-carousel-slide img').all();
    console.log(`\nFound ${carouselImages.length} carousel images`);
    
    for (let i = 0; i < carouselImages.length; i++) {
      const img = carouselImages[i];
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const className = await img.getAttribute('class');
      const dataFallback = await img.getAttribute('data-fallback');
      const naturalWidth = await img.evaluate(el => el.naturalWidth);
      const naturalHeight = await img.evaluate(el => el.naturalHeight);
      console.log(`  Image ${i+1}: src=${src}, alt=${alt}, class=${className}, fallback=${dataFallback}, naturalSize=${naturalWidth}x${naturalHeight}`);
    }
    
    // Check for placeholders
    const placeholders = await page.locator('.img-placeholder').all();
    console.log(`\nPlaceholders found: ${placeholders.length}`);
    for (let i = 0; i < placeholders.length; i++) {
      const ph = placeholders[i];
      const src = await ph.getAttribute('src');
      const alt = await ph.getAttribute('alt');
      console.log(`  Placeholder ${i+1}: src=${src}, alt=${alt}`);
    }
    
    // Console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    console.log(`\nConsole errors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.text}`));
    
    // Console warnings
    const warns = consoleMessages.filter(m => m.type === 'warning');
    console.log(`\nConsole warnings (${warns.length}):`);
    warns.forEach(e => console.log(`  ${e.text}`));
    
    // Failed requests
    console.log(`\nFailed requests (${failedRequests.length}):`);
    failedRequests.forEach(r => console.log(`  ${r.url}: ${r.failure?.errorText}`));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await browser.close();
})();