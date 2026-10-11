const fs = require('fs');
const path = 'H:\\VScode\\Proyectos\\Nueva carpeta\\frontend\\js\\admin-testimonials.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic character is a fancy right single quote (U+2019)
// Replace it with the proper HTML entity ' (5 ASCII chars)
content = content.replace(/\u2019/g, ''');  // Right single quotation mark
content = content.replace(/\u2018/g, ''');  // Left single quotation mark
content = content.replace(/\u201C/g, '"'); // Left double quotation mark
content = content.replace(/\u201D/g, '"'); // Right double quotation mark

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed fancy quotes');