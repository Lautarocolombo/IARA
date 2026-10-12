'use strict';

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { Pool } = require('pg');
const { runMigrations: runSqlMigrations, checkMigrations: checkSqlMigrations } = require('../lib/migrator');

function createPool() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  const options = {
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000
  };

  if (connectionString) {
    options.connectionString = connectionString;
    if (process.env.NODE_ENV === 'production') {
      options.ssl = { rejectUnauthorized: false };
    }
  } else {
    options.database = process.env.DB_NAME || process.env.PGDATABASE || 'postgres';
    options.host = process.env.DB_HOST || 'localhost';
    options.port = Number.parseInt(process.env.DB_PORT || '5432', 10);
    options.user = process.env.DB_USER || process.env.PGUSER || 'postgres';
    options.password = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';
  }

  return new Pool(options);
}

async function withDatabase(callback) {
  const pool = createPool();
  try {
    return await callback(pool.query.bind(pool));
  } finally {
    await pool.end();
  }
}

async function runMigrations(direction = 'up') {
  if (direction !== 'up') {
    throw new Error('Las migraciones down están deshabilitadas. Restaurá un snapshot verificado para revertir cambios.');
  }

  return withDatabase(async query => {
    await runSqlMigrations(query);
    console.log('[migrations] Migraciones aplicadas correctamente');
  });
}

async function checkMigrations() {
  return withDatabase(async query => {
    const pending = await checkSqlMigrations(query);
    if (pending.length) {
      console.log(`[migrations] Pendientes (${pending.length}): ${pending.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log('[migrations] Verificación completada: no hay migraciones pendientes');
  });
}

async function main() {
  const command = process.argv[2] || 'up';
  if (command === 'check') {
    await checkMigrations();
  } else if (command === 'up') {
    await runMigrations('up');
  } else if (command === 'down') {
    throw new Error('Las migraciones down están deshabilitadas. Restaurá un snapshot verificado para revertir cambios.');
  } else {
    throw new Error('Uso: node run-migrations.js [up|check]');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[migrations] Error: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runMigrations, checkMigrations };
