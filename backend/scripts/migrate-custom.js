'use strict';

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { query, initDB, closeDB, isLocal } = require('../src/lib/db');
const { runMigrations } = require('../src/lib/migrator');

async function runCustomMigrations(direction = 'up') {
  try {
    if (direction === 'down') {
      console.log('[migrate-custom] Rollback no soportado en migrador custom. Usa migraciones SQL con DOWN manual.');
      process.exit(1);
    }

    await initDB();
    console.log('[migrate-custom] Base de datos inicializada, ejecutando migraciones...');

    await runMigrations(query);

    console.log('[migrate-custom] Migraciones aplicadas correctamente');
  } catch (err) {
    console.error('[migrate-custom] Error ejecutando migraciones:', err.message);
    throw err;
  } finally {
    await closeDB();
  }
}

async function checkMigrations() {
  try {
    await initDB();

    const result = await query(`
      SELECT name FROM migrations ORDER BY name
    `);

    const applied = result.rows.map(r => r.name);
    const files = fs.readdirSync(path.join(__dirname, '..', 'migrations'))
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const pending = files.filter(f => !applied.includes(f));

    if (pending.length === 0) {
      console.log('[migrate-custom] Verificación completada: no hay migraciones pendientes');
    } else {
      console.log('[migrate-custom] Migraciones pendientes:', pending.join(', '));
      process.exit(1);
    }
  } catch (err) {
    console.error('[migrate-custom] Error en verificación:', err.message);
    throw err;
  } finally {
    await closeDB();
  }
}

async function main() {
  const command = process.argv[2] || 'up';
  if (!['up', 'down', 'check'].includes(command)) {
    console.error('Uso: node migrate-custom.js [up|down|check]');
    process.exit(1);
  }
  if (command === 'check') {
    await checkMigrations();
  } else {
    await runCustomMigrations(command);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runCustomMigrations, checkMigrations };