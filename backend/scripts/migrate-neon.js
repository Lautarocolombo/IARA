'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const fixScript = path.join(__dirname, 'fix-pgmigrations.js');

try {
  const fixResult = spawnSync(process.execPath, [fixScript], {
    stdio: 'inherit',
    timeout: 60000
  });

  if (fixResult.status !== 0 && fixResult.status !== null) {
    console.error('[migrate-neon] fix-pgmigrations falló, abortando migraciones');
    process.exit(fixResult.status || 1);
  }
} catch (err) {
  console.warn('[migrate-neon] No se pudo ejecutar fix-pgmigrations:', err.message);
}

const { runMigrations } = require('./run-migrations');

async function main() {
  await runMigrations('up');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
