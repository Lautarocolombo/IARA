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

  files.forEach(file => {
    it(`should not have syntax errors in ${file}`, () => {
      const fullPath = path.join(__dirname, '..', '..', file);
      const code = fs.readFileSync(fullPath, 'utf8');
      expect(() => new Function(code)).not.toThrow();
    });
  });
});
