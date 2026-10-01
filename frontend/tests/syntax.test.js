/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Frontend core files syntax', () => {
  const files = [
    'frontend/js/config.js',
    'frontend/js/safeImage.js',
    'frontend/js/ui.js',
    'frontend/js/connection.js',
    'frontend/js/cart.js',
    'frontend/js/wishlist.js',
    'frontend/js/products.js',
    'frontend/js/hero.js',
    'frontend/js/payment.js',
    'frontend/js/checkout.js',
    'frontend/js/admin.js'
  ];

  const moduleFiles = new Set(['frontend/js/checkout.js']);

  files.forEach(file => {
    it(`should not have syntax errors in ${file}`, () => {
      const fullPath = path.join(__dirname, '..', '..', file);
      let code = fs.readFileSync(fullPath, 'utf8');
      if (moduleFiles.has(file)) {
        code = code.replace(/^\s*import[\s\S]*?;\s*/m, '');
      }
      expect(() => new Function(code)).not.toThrow();
    });
  });
});
