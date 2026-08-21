const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('data/iara.db');

const tables = ['products','site_texts','testimonials','section_content','orders','contacts','reviews','hero_cards','categories','payment_config','site_settings','customers','activity_log','product_bulk_imports'];
const mojibake = ['Ã¡','Ã©','Ã­','Ã³','Ãº','Ã±','Â¿','Â¡','â€™','â€œ','â€','â€"','â€¦'];
let total = 0;

function hasMojibake(str) {
  return mojibake.some(p => String(str).includes(p));
}

async function checkTable(t) {
  return new Promise((resolve) => {
    db.all('SELECT * FROM ' + t + ' LIMIT 500', (err, rows) => {
      if (err) return resolve([{table: t, error: err.message}]);
      const bad = [];
      for (const r of rows) {
        for (const [col, val] of Object.entries(r)) {
          if (typeof val === 'string' && hasMojibake(val)) {
            bad.push({table: t, row: r, column: col, value: val});
          }
        }
      }
      resolve(bad);
    });
  });
}

(async () => {
  for (const t of tables) {
    const rows = await checkTable(t);
    for (const r of rows) {
      console.log(JSON.stringify(r));
      total++;
    }
  }
  console.log('TOTAL CORRUPTOS:', total);
  db.close();
})();
