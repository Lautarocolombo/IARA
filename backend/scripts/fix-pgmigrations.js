'use strict';

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.log('[fix-pgmigrations] No DATABASE_URL configurada, omitiendo');
    process.exit(0);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  });

  const client = await pool.connect();
  try {
    const tableCheck = await client.query(`
      SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'pgmigrations'
    `);

    if (tableCheck.rows[0].count === 0) {
      console.log('[fix-pgmigrations] Tabla pgmigrations no existe, omitiendo');
      return;
    }

    const existing = await client.query('SELECT name FROM pgmigrations');
    const existingNames = new Set(existing.rows.map(r => r.name));

    if (existingNames.has('001_add_order_token.sql')) {
      await client.query("DELETE FROM pgmigrations WHERE name = '001_add_order_token.sql'");
      console.log('[fix-pgmigrations] Entrada huérfana 001_add_order_token.sql eliminada');
    }

    if (!existingNames.has('001_init_schema.sql')) {
      await client.query("INSERT INTO pgmigrations (name) VALUES ('001_init_schema.sql') ON CONFLICT (name) DO NOTHING");
      console.log('[fix-pgmigrations] Entrada 001_init_schema.sql marcada como aplicada');
    }

    console.log('[fix-pgmigrations] pgmigrations corregido');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[fix-pgmigrations] Error:', err.message);
  process.exit(1);
});
