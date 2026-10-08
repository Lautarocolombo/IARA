const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
const content = fs.readFileSync(indexPath, 'utf8');

// Extract script src in order from body (excluding head scripts and inline scripts)
const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) {
  console.error('No body tag found');
  process.exit(1);
}

const bodyContent = bodyMatch[1];

// Find all <script src="..."> in order
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

console.log('=== Script Order Verification ===\n');
console.log('Found scripts in index.html (body):');
scripts.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

console.log('\nExpected order:');
expectedOrder.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

// Check if all expected scripts are present
const missing = expectedOrder.filter(s => !scripts.includes(s));
const extra = scripts.filter(s => !expectedOrder.includes(s) && !s.startsWith('http'));

if (missing.length > 0) {
  console.error('\n❌ MISSING scripts (expected but not found):');
  missing.forEach(s => console.error(`  - ${s}`));
}

if (extra.length > 0) {
  console.warn('\n⚠️  EXTRA scripts (found but not in expected order):');
  extra.forEach(s => console.warn(`  - ${s}`));
}

// Check order
let orderOk = true;
let lastIndex = -1;
for (const expected of expectedOrder) {
  const idx = scripts.indexOf(expected);
  if (idx === -1) continue; // Already reported as missing
  if (idx < lastIndex) {
    console.error(`\n❌ ORDER VIOLATION: ${expected} appears before previous script`);
    orderOk = false;
  }
  lastIndex = idx;
}

if (orderOk && missing.length === 0) {
  console.log('\n✅ Script order is CORRECT');
  process.exit(0);
} else {
  console.log('\n❌ Script order verification FAILED');
  process.exit(1);
}