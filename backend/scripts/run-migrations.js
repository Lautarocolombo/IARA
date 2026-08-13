'use strict';

const { runner } = require('node-pg-migrate');
const path = require('path');

async function runMigrations(direction = 'up') {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  const config = {
    dir: path.join(__dirname, '..', 'migrations'),
    schema: 'public',
    migrationsTable: 'pgmigrations',
    createMigrationsTable: true,
    createSchemas: false,
    disableTransaction: false,
    dirList: [path.join(__dirname, '..', 'migrations')],
  };

  if (connectionString) {
    config.databaseUrl = connectionString;
    config.ssl = { rejectUnauthorized: false };
  } else {
    config.database = process.env.DB_NAME || process.env.PGDATABASE || 'postgres';
    config.host = process.env.DB_HOST || 'localhost';
    config.port = parseInt(process.env.DB_PORT || '5432', 10);
    config.username = process.env.DB_USER || process.env.PGUSER || 'postgres';
    config.password = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';
  }

  try {
    await runner({
      ...config,
      direction,
    });
    console.log(`[migrations] Migraciones ${direction === 'up' ? 'aplicadas' : 'revertidas'} correctamente`);
  } catch (err) {
    console.error('[migrations] Error ejecutando migraciones:', err.message);
    throw err;
  }
}

async function main() {
  const direction = process.argv[2] || 'up';
  if (!['up', 'down'].includes(direction)) {
    console.error('Uso: node run-migrations.js [up|down]');
    process.exit(1);
  }
  await runMigrations(direction);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runMigrations };
