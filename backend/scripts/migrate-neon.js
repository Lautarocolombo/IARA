'use strict';

// Script de utilidad para ejecutar migraciones manualmente en Neon/Postgres.
// Usa node-pg-migrate con la tabla de control 'pgmigrations'.
// NOTA: En producción, el backend ejecuta migraciones automáticamente al arrancar
// via backend/src/lib/migrator.js (tabla 'migrations'). Este script es solo para
// mantenimiento manual o para bases de datos que no usan el backend.

const { runMigrations } = require('./run-migrations');

async function main() {
  await runMigrations('up');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});