const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const response = await page.goto('http://localhost:3000/pages/success.html', { waitUntil: 'commit' });
  const html = await response.text();
  const start = html.indexOf('id="successCard"');
  const end = html.indexOf('</main>', start);
  console.log(html.substring(start, end));
  await browser.close();
})();