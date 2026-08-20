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

function mapRow(table, row) {
  const mapped = { ...row };

  if (table === 'products') {
    if (mapped.category && !mapped.category_id) {
      mapped.category_id = null;
    }
    delete mapped.category;
  }

  if (table === 'categories') {
    if (mapped.image && !mapped.icon) {
      mapped.icon = mapped.image;
    }
    if (mapped.orden !== undefined && !mapped.sort_order) {
      mapped.sort_order = mapped.orden;
    }
    delete mapped.image;
  }

  if (table === 'testimonials') {
    if (mapped.created_at && String(mapped.created_at).length > 10) {
      const ts = Number(mapped.created_at);
      if (!Number.isNaN(ts)) {
        mapped.created_at = new Date(ts).toISOString();
      }
    }
    if (mapped.orden !== undefined && mapped.orden === 0) {
      mapped.orden = null;
    }
  }

  if (table === 'product_images') {
    if (mapped.watermark_opacidad !== undefined) {
      delete mapped.watermark_opacidad;
    }
    if (mapped.watermark_posicion !== undefined) {
      delete mapped.watermark_posicion;
    }
    if (mapped.watermark_tamano !== undefined) {
      delete mapped.watermark_tamano;
    }
    if (mapped.estado !== undefined) {
      delete mapped.estado;
    }
    if (mapped.nombre_seo !== undefined) {
      delete mapped.nombre_seo;
    }
    if (mapped.slug_seo !== undefined) {
      delete mapped.slug_seo;
    }
  }

  if (table === 'reviews') {
    if (mapped.comment && !mapped.customer_name) {
      mapped.customer_name = mapped.comment;
    }
  }

  if (table === 'subscribers') {
    if (!mapped.name) {
      mapped.name = '';
    }
    if (mapped.active === undefined) {
      mapped.active = true;
    }
  }

  if (table === 'site_texts') {
    if (mapped.key && mapped.key.includes(' ')) {
      mapped.key = mapped.key.replace(/\s+/g, '_').toLowerCase();
    }
  }

  return mapped;
}

async function getLocalData() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      return reject(new Error('Local DB not found'));
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
          results[table] = rows.map(row => mapRow(table, row));
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

async function syncToNeon() {
  console.log('=== SINCRONIZACIÓN LOCAL → NEON ===\n');

  if (!NEON_URL) {
    console.error('ERROR: NEON_DATABASE_URL o DATABASE_URL no configurada');
    process.exit(1);
  }

  console.log('Conectando a Neon...');
  const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a Neon\n');
  } catch (err) {
    console.error('Error conectando:', err.message);
    await pool.end();
    process.exit(1);
  }

  console.log('Leyendo base local...');
  const local = await getLocalData();
  console.log(`Local: ${Object.keys(local).length} tablas leídas\n`);

  const tables = Object.keys(local);
  let totalSynced = 0;

  for (const table of tables) {
    const rows = local[table];
    if (!rows || rows.length === 0) {
      console.log(`  ${table}: sin datos locales, se salta`);
      continue;
    }

    console.log(`Sincronizando ${table} (${rows.length} registros)...`);

    const sample = rows[0];
    const columns = Object.keys(sample);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');
    const updateSet = columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ');

    const sql = `
      INSERT INTO ${table} (${columnNames})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `;

    let synced = 0;
    for (const row of rows) {
      try {
        const values = columns.map(col => row[col]);
        await client.query(sql, values);
        synced++;
      } catch (err) {
        console.error(`  Error sincronizando ${table} id=${row.id}: ${err.message}`);
      }
    }

    console.log(`  ✅ ${synced}/${rows.length} registros sincronizados`);
    totalSynced += synced;
  }

  await client.release();
  await pool.end();

  console.log(`\n=== SINCRONIZACIÓN COMPLETA ===`);
  console.log(`Total registros sincronizados: ${totalSynced}`);
  console.log('\nVerificá con: node scripts/check-sync.js');
}

syncToNeon().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
