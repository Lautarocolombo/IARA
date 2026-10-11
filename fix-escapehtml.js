const fs = require('fs');
const path = 'H:\\VScode\\Proyectos\\proyectos en armados\\iara3\\frontend\\js\\products.js';
let content = fs.readFileSync(path, 'utf8');

// Restore original escapeHtml function with proper HTML entities
const originalEscapeHtml = `function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '');
}`;

content = content.replace(/function escapeHtml\(str\) \{[\s\S]*?\n\}/, originalEscapeHtml);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed escapeHtml');