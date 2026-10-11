const fs = require('fs');
const path = 'H:\\VScode\\Proyectos\\Nueva carpeta\\frontend\\js\\admin-testimonials.js';
let content = fs.readFileSync(path, 'utf8');

// Build the correct replacement string programmatically to avoid quote issues
const correctReplacement = "&" + "#" + "39;";
// The problematic pattern has three literal apostrophes (char code 0x27)
const badPattern = "s = s.replace(/'/g, ''');";  // This has the three apostrophes in source
const goodPattern = "s = s.replace(/'/g, '" + correctReplacement + "');";

console.log('Bad pattern:', badPattern);
console.log('Good pattern:', goodPattern);

content = content.replace(badPattern, goodPattern);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');