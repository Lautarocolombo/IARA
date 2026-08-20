const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const NEON_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const LOCAL_DB_PATH = path.join(__dirname, '..', 'backend', 'data', 'artesaniagualeguay.db');

async function getLocalData() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      return reject(new Error('Local DB not found at ' + LOCAL_DB_PATH));
    }
    const db = new sqlite3.Database(LOCAL_DB_PATH);
    const results = {};
    const tables = ['products', 'categories', 'orders', 'testimonials', 'site_texts', 'hero_cards', 'payment_config', 'site_settings', 'reviews', 'contacts', 'subscribers', 'customers', 'product_images'];
    let pending = tables.length;
    tables.forEach(table => {
      db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) {
          console.error(`Error reading ${table}:`, err.message);
          results[table] = [];
        } else {
          results[table] = rows;
        }
        pending--;
        if (pending === 0) {
          db.close();
          resolve(results);
        }
      });
    });
  });
}

async function getNeonData() {
  if (!NEON_URL) {
    throw new Error('NEON_DATABASE_URL or DATABASE_URL not set');
  }
  const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  });
  try {
    const client = await pool.connect();
    const results = {};
    const tables = ['products', 'categories', 'orders', 'testimonials', 'site_texts', 'hero_cards', 'payment_config', 'site_settings', 'reviews', 'contacts', 'subscribers', 'customers', 'product_images'];
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT * FROM ${table}`);
        results[table] = res.rows;
      } catch (err) {
        console.error(`Error reading ${table} from Neon:`, err.message);
        results[table] = [];
      }
    }
    client.release();
    await pool.end();
    return results;
  } catch (err) {
    await pool.end();
    throw err;
  }
}

async function compareAndSync() {
  console.log('=== DIAGNÓSTICO DE SINCRONIZACIÓN ===\n');

  console.log('Leyendo base de datos LOCAL...');
  const local = await getLocalData();
  console.log(`Local: ${Object.keys(local).length} tablas leídas`);

  console.log('\nLeyendo base de datos NEON...');
  let neon = {};
  try {
    neon = await getNeonData();
    console.log(`Neon: ${Object.keys(neon).length} tablas leídas`);
  } catch (err) {
    console.error('ERROR conectando a Neon:', err.message);
    console.log('\nVerificá que:');
    console.log('1. DATABASE_URL o NEON_DATABASE_URL esté configurada');
    console.log('2. La connection string tenga el formato: postgresql://user:pass@host:5432/db?sslmode=require');
    console.log('3. La DB de Neon exista y tenga las tablas creadas');
    process.exit(1);
  }

  console.log('\n=== COMPARACIÓN ===');
  const tables = Object.keys(local);
  let syncNeeded = false;

  for (const table of tables) {
    const localCount = local[table].length;
    const neonCount = neon[table] ? neon[table].length : 0;
    const diff = localCount - neonCount;

    console.log(`\n${table}:`);
    console.log(`  Local: ${localCount} registros`);
    console.log(`  Neon:  ${neonCount} registros`);

    if (diff > 0) {
      console.log(`  ⚠️  Faltan ${diff} registros en Neon`);
      syncNeeded = true;
    } else if (diff < 0) {
      console.log(`  ℹ️  Neon tiene ${Math.abs(diff)} registros más (puede ser normal si se crearon directo en producción)`);
    } else {
      console.log(`  ✅ Sincronizado (${localCount} registros)`);
    }
  }

  if (syncNeeded) {
    console.log('\n=== SINCRONIZACIÓN ===');
    console.log('Para sincronizar datos de Local → Neon, ejecutá:');
    console.log('  node scripts/sync-to-neon.js');
  } else {
    console.log('\n✅ Ambas bases están sincronizadas');
  }
}

compareAndSync().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
