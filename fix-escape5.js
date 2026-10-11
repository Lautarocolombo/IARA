const fs = require('fs');
const path = 'H:\\VScode\\Proyectos\\Nueva carpeta\\frontend\\js\\admin-testimonials.js';
let content = fs.readFileSync(path, 'utf8');

// Fix the specific problematic line: replace three literal apostrophes with HTML entity
// The pattern is: s = s.replace(/'/g, ''');
// We need to replace the three apostrophes (0x27 0x27 0x27) with & # 3 9 ;
content = content.replace(
  "s = s.replace(/'/g, ''');",
  "s = s.replace(/'/g, ''');"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');