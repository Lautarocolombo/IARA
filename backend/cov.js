const fs = require('fs');
const path = require('path');
const p = path.join('H:\\VScode\\Proyectos\\proyectos en armados\\Nueva carpeta\\backend\\coverage\\coverage-final.json');
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
const rows = Object.entries(c).map(([f, d]) => {
  const sTotal = Object.keys(d.s).length;
  const sHit = Object.values(d.s).filter(Boolean).length;
  const fTotal = Object.keys(d.f).length;
  const fHit = Object.values(d.f).filter(Boolean).length;
  const bTotal = Object.values(d.b).reduce((a, v) => a + v.length, 0);
  const bHit = Object.values(d.b).reduce((a, v) => a + v.filter(Boolean).length, 0);
  return { f, sPct: sTotal ? (sHit / sTotal * 100) : 100, fPct: fTotal ? (fHit / fTotal * 100) : 100, bPct: bTotal ? (bHit / bTotal * 100) : 100 };
}).sort((a, b) => a.sPct - b.sPct);
rows.slice(0, 50).forEach(x => {
  console.log(x.sPct.toFixed(1) + '% S ' + x.fPct.toFixed(1) + '% F ' + x.bPct.toFixed(1) + '% B ' + x.f.replace(/.*backend\\src\\/, ''));
});