const fs = require('fs');
const path = require('path');

describe('Script order verification', () => {
  const indexPath = path.join(__dirname, '..', '..', 'frontend', 'index.html');
  const content = fs.readFileSync(indexPath, 'utf8');

  test('body scripts are in correct dependency order', () => {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    expect(bodyMatch).toBeTruthy();

    const bodyContent = bodyMatch[1];
    const scriptRegex = /<script\s+src="([^"]+)"[^>]*>/g;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(bodyContent)) !== null) {
      scripts.push(match[1]);
    }

    // Expected order (critical dependencies first)
    const expectedOrder = [
      'https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js',
      'js/config.js',           // Must be first - exposes CONFIG
      'js/safeImage.js',        // Exposes renderProductImage, createSafeImage, etc.
      'js/header.js',           // Uses CONFIG
      'js/theme.js',            // Independent
      'js/cookie-consent.js',   // Independent
      'js/ui.js',               // Exposes showToast, escapeHtml, etc.
      'js/wishlist.js',         // Uses ui.js (showToast), CONFIG
      'js/cart.js',             // Uses ui.js, CONFIG
      'js/products.js',         // Uses safeImage.js, ui.js, CONFIG
      'js/hero.js',             // Uses safeImage.js, ui.js
      'js/counters.js',         // Independent
      'js/about-carousel.js',   // Uses safeImage.js
      'js/home-init.js',        // Must be last - initializes everything
    ];

    // All expected scripts must be present
    for (const expected of expectedOrder) {
      expect(scripts).toContain(expected);
    }

    // Order must be preserved
    let lastIndex = -1;
    for (const expected of expectedOrder) {
      const idx = scripts.indexOf(expected);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  test('no duplicate script tags in body', () => {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch[1];
    const scriptRegex = /<script\s+src="([^"]+)"[^>]*>/g;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(bodyContent)) !== null) {
      scripts.push(match[1]);
    }

    const uniqueScripts = new Set(scripts);
    expect(scripts.length).toBe(uniqueScripts.size);
  });
});