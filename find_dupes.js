const fs = require('fs');
const path = require('path');
const routesDir = 'H:\\VScode\\Proyectos\\proyectos en armados\\Nueva carpeta\\backend\\src\\routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
const routes = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const matches = content.matchAll(/router\.(get|post|put|patch|delete)\(\[?['\"]([^'\"]+)['\"\]?(?:,\s*['\"][^'\"]+['\"])?\)/g);
  for (const m of matches) {
    routes.push({ file, method: m[1], path: m[2] });
  }
}
const seen = {};
for (const r of routes) {
  const key = r.method + ' ' + r.path;
  if (seen[key]) {
    console.log('DUPLICATE: ' + key + ' -> ' + r.file + ' and ' + seen[key].file);
  } else {
    seen[key] = r;
  }
}
