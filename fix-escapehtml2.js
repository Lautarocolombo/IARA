const fs = require('fs');
const path = 'H:\\VScode\\Proyectos\\proyectos en armados\\iara3\\frontend\\js\\products.js';
let content = fs.readFileSync(path, 'utf8');

// Restore original escapeHtml function with proper HTML entities (using escaped strings)
const originalEscapeHtml = "function escapeHtml(str) {\n  if (!str) return '';\n  return String(str)\n    .replace(/&/g, '&' + 'amp;')\n    .replace(/</g, '&' + 'lt;')\n    .replace(/>/g, '&' + 'gt;')\n    .replace(/\"/g, '&' + 'quot;')\n    .replace(/'/g, '&#' + '39;');\n}";

content = content.replace(/function escapeHtml\(str\) \{[\s\S]*?\n\}/, originalEscapeHtml);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed escapeHtml');