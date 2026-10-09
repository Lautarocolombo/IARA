const fs = require('fs');
const path = 'H:\\VScode\\Proyectos\\Nueva carpeta\\frontend\\js\\admin-testimonials.js';
let content = fs.readFileSync(path, 'utf8');

// Fix the escapeHtml function - replace the problematic line
// The issue is that the replacement string contains a literal single quote
// We need to use the HTML entity ' which doesn't contain any quote characters
content = content.replace(
  /s = s\.replace\(\/'\/g, ''''\);/,
  "s = s.replace(/'/g, ''');"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');