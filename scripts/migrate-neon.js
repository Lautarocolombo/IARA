const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const NEON_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

async function migrate() {
  if (!NEON_URL) {
    console.error('ERROR: NEON_DATABASE_URL o DATABASE_URL no configurada');
    process.exit(1);
  }

  console.log('Conectando a Neon para aplicar migraciones...');
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

  const migrations = [
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT \'\'',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS transfer_alias TEXT DEFAULT \'\'',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS cbu_cvu TEXT DEFAULT \'\'',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN DEFAULT FALSE',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS cash_enabled BOOLEAN DEFAULT FALSE',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS shipping_cost REAL DEFAULT 0',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS free_shipping_from REAL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT \'\'',
    'ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS watermark_texto TEXT DEFAULT \'\'',
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT \'\'',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT \'\'',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS subtitulo TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS cta_texto TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS cta_url TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS slot INTEGER DEFAULT 0',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT \'hero\'',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
    'CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id)'
  ];

  let applied = 0;
  let skipped = 0;

  for (const sql of migrations) {
    try {
      await client.query(sql);
      applied++;
      console.log(`  ✅ ${sql.substring(0, 80)}...`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate') || err.message.includes('does not exist')) {
        skipped++;
      } else {
        console.error(`  ❌ ${sql.substring(0, 80)}...`);
        console.error(`     Error: ${err.message}`);
      }
    }
  }

  await client.release();
  await pool.end();

  console.log(`\n=== MIGRACIONES APLICADAS ===`);
  console.log(`Nuevas: ${applied}`);
  console.log(`Ya existían: ${skipped}`);
  console.log('\nAhora ejecutá: node scripts/sync-to-neon.js');
}

migrate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
