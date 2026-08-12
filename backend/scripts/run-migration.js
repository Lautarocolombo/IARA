const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: false });
const { initDB, query } = require('../src/lib/db');

async function run() {
  try {
    await initDB();
    const sqlPath = path.join(__dirname, '..', '..', 'scripts', 'migrations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let ok = 0;
    let fail = 0;
    for (const stmt of statements) {
      try {
        await query(stmt);
        ok++;
      } catch (err) {
        fail++;
        console.error('[Migration] Error ejecutando sentencia:', err.message);
        console.error('[Migration] SQL:', stmt.substring(0, 200));
      }
    }
    console.log(`[Migration] Completado. OK: ${ok}, Fallos: ${fail}`);
    process.exit(fail > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Migration] Error inicializando:', err.message);
    process.exit(1);
  }
}

run();
