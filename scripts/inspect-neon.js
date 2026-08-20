const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const NEON_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

async function inspect() {
  if (!NEON_URL) {
    console.error('ERROR: NEON_DATABASE_URL o DATABASE_URL no configurada');
    process.exit(1);
  }

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
  } catch (err) {
    console.error('Error conectando:', err.message);
    await pool.end();
    process.exit(1);
  }

  const tables = ['products', 'categories', 'orders', 'testimonials', 'site_texts', 'hero_cards', 'payment_config', 'site_settings', 'reviews', 'contacts', 'subscribers', 'customers', 'product_images'];

  console.log('=== ESQUEMA DE NEON ===\n');

  for (const table of tables) {
    try {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.log(`${table}:`);
      res.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      console.log('');
    } catch (err) {
      console.error(`  Error: ${err.message}\n`);
    }
  }

  await client.release();
  await pool.end();
}

inspect().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
