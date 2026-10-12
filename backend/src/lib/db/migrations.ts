import logger from '../logger';
import { query } from './query';
import { runMigrations } from '../migrator';

async function ensureMigrationsTable(queryFn: (sql: string) => Promise<any>): Promise<void> {
  await queryFn('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
}

async function getAppliedMigrations(queryFn: (sql: string) => Promise<any>): Promise<Set<string>> {
  const result = await queryFn('SELECT name FROM migrations');
  return new Set(result.rows.map((r: { name: string }) => r.name));
}

async function runMigrationsOnly(): Promise<void> {
  if (runMigrations) {
    try {
      await runMigrations(query);
      logger.info('Migraciones versionadas aplicadas (PostgreSQL)');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'No se pudieron aplicar migraciones versionadas');
    }
  }
}

async function runSQLiteMigrations(): Promise<void> {
  await query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');

  const sqliteRenameMigrations = [
    { name: 'rename_sort_order_to_orden', oldCol: 'sort_order', sql: 'ALTER TABLE product_images RENAME COLUMN sort_order TO orden' },
    { name: 'rename_is_primary_to_es_principal', oldCol: 'is_primary', sql: 'ALTER TABLE product_images RENAME COLUMN is_primary TO es_principal' }
  ];

  for (const mig of sqliteRenameMigrations) {
    const applied = await query('SELECT COUNT(*) AS count FROM migrations WHERE name = ?', [mig.name]);
    if (applied.rows[0].count > 0) continue;
    const pragmaResult = await query('PRAGMA table_info(product_images)');
    const colExists = pragmaResult.rows.some((row: { name: string }) => row.name === mig.oldCol);
    if (colExists) {
      await query(mig.sql);
    }
    await query('INSERT OR IGNORE INTO migrations (name) VALUES (?)', [mig.name]);
  }
}

export { runMigrationsOnly, runSQLiteMigrations, ensureMigrationsTable, getAppliedMigrations };