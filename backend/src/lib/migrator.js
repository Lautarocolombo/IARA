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

async function runMigrations(query) {
  try {
    await ensureMigrationsTable(query);
    const applied = await getAppliedMigrations(query);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of files) {
      if (applied.has(file)) continue;

      const filePath = path.join(MIGRATIONS_DIR, file);
      let sql = '';

      if (!file.endsWith('.sql')) {
        logger.warn({ migration: file }, 'Migración no SQL omitida');
        continue;
      }

      sql = fs.readFileSync(filePath, 'utf8').trim();
      if (!sql) continue;

      try {
        await query(sql);
        await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
        logger.info({ migration: file }, 'Migración aplicada');
      } catch (err) {
        logger.warn({ migration: file, err: err.message }, 'Migración falló, marcando como aplicada y continuando');
        try {
          await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
        } catch (insertErr) {
          logger.error({ migration: file, err: insertErr.message }, 'No se pudo marcar migración como aplicada');
        }
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error ejecutando migraciones');
    throw err;
  }
}

module.exports = { runMigrations };
