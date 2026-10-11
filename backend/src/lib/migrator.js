const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(query) {
  await query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
}

async function getAppliedMigrations(query) {
  const result = await query('SELECT name FROM migrations');
  return new Set(result.rows.map(r => r.name));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function checkMigrations(query) {
  const applied = await getAppliedMigrations(query);
  return getMigrationFiles().filter(file => !applied.has(file));
}

async function runMigrations(query) {
  await ensureMigrationsTable(query);
  const pending = await checkMigrations(query);

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').trim();
    if (!sql) continue;

    try {
      await query(sql);
      await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
      logger.info({ migration: file }, 'Migración aplicada');
    } catch (err) {
      logger.error({ migration: file, err: err.message }, 'Migración falló');
      throw new Error(`Migración ${file} falló: ${err.message}`);
    }
  }
}

module.exports = { runMigrations, checkMigrations };