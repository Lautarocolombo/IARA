const fs = require('fs');
const path = require('path');
const { query } = require('./db');
const logger = require('./logger');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable() {
  await query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
}

async function getAppliedMigrations() {
  const result = await query('SELECT name FROM migrations');
  return new Set(result.rows.map(r => r.name));
}

async function runMigrations() {
  try {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of files) {
      if (applied.has(file)) continue;

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8').trim();

      if (!sql) continue;

      try {
        await query(sql);
        await query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        logger.info({ migration: file }, 'Migración aplicada');
      } catch (err) {
        logger.warn({ migration: file, err: err.message }, 'Migración falló, continuando con la siguiente');
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error ejecutando migraciones');
    throw err;
  }
}

module.exports = { runMigrations };
