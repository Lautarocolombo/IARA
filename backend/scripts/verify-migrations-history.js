#!/usr/bin/env node
/**
 * verify-migrations-history.js — Verifica historial de migraciones en Neon
 *
 * Uso:
 *   Configurá DATABASE_URL en el entorno o backend/.env y ejecutá:
 *   node scripts/verify-migrations-history.js
 *
 * Compara:
 * 1. Tabla `migrations` (aplicadas por migrador custom)
 * 2. Tabla `pgmigrations` (aplicadas por node-pg-migrate, si existe)
 * 3. Archivos locales en `backend/migrations/*.sql`
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const pg = require('pg');
const Pool = pg.Pool;

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function createPool() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no configurada');
  }
  const options = {
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
  console.log('[debug] Creating Pool with options:', JSON.stringify(options, null, 2));
  const pool = new Pool(options);
  console.log('[debug] Pool created:', typeof pool, 'keys:', Object.keys(pool));
  return pool;
}

function getLocalMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql') && !file.endsWith('.HOLD'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function main() {
  console.log('[migrations-history] Conectando a Neon...');
  const pool = createPool();
  console.log('[debug] pool created, type:', typeof pool, 'end:', typeof pool?.end);

  try {
    // 1. Verificar tabla `migrations` (custom migrator)
    console.log('\n📋 Tabla `migrations` (custom migrator):');
    try {
      const result = await pool.query('SELECT name, applied_at FROM migrations ORDER BY applied_at');
      if (result.rows.length === 0) {
        console.log('  (vacía)');
      } else {
        for (const row of result.rows) {
          console.log(`  ✅ ${row.name}  —  ${row.applied_at}`);
        }
        console.log(`  Total: ${result.rows.length} migraciones aplicadas`);
      }
    } catch (err) {
      if (err.code === '42P01') {
        console.log('  ⚠️  Tabla `migrations` no existe');
      } else {
        throw err;
      }
    }

    // 2. Verificar tabla `pgmigrations` (node-pg-migrate)
    console.log('\n📋 Tabla `pgmigrations` (node-pg-migrate):');
    try {
      const result = await pool.query('SELECT name, run_on FROM pgmigrations ORDER BY run_on');
      if (result.rows.length === 0) {
        console.log('  (vacía)');
      } else {
        for (const row of result.rows) {
          console.log(`  ✅ ${row.name}  —  ${row.run_on}`);
        }
        console.log(`  Total: ${result.rows.length} migraciones aplicadas`);
      }
    } catch (err) {
      if (err.code === '42P01') {
        console.log('  ⚠️  Tabla `pgmigrations` no existe (no se usó node-pg-migrate)');
      } else {
        throw err;
      }
    }

    // 3. Archivos locales
    const localFiles = getLocalMigrationFiles();
    console.log('\n📁 Archivos locales en backend/migrations/ (*.sql, excluyendo .HOLD):');
    for (const file of localFiles) {
      console.log(`  📄 ${file}`);
    }
    console.log(`  Total: ${localFiles.length} archivos`);

    // 4. Comparación
    console.log('\n🔍 COMPARACIÓN:');
    let appliedCustom = [];
    let appliedPg = [];

    try {
      const r = await pool.query('SELECT name FROM migrations');
      appliedCustom = r.rows.map(r => r.name);
    } catch {}

    try {
      const r = await pool.query('SELECT name FROM pgmigrations');
      appliedPg = r.rows.map(r => r.name);
    } catch {}

    const allApplied = [...new Set([...appliedCustom, ...appliedPg])];

    const missingInDb = localFiles.filter(f => !allApplied.includes(f));
    const extraInDb = allApplied.filter(f => !localFiles.includes(f));

    if (missingInDb.length === 0 && extraInDb.length === 0) {
      console.log('  ✅ PERFECTO: Local y BD coinciden exactamente');
    } else {
      if (missingInDb.length > 0) {
        console.log(`  ⚠️  FALTAN EN BD (${missingInDb.length}):`);
        for (const f of missingInDb) console.log(`     - ${f}`);
      }
      if (extraInDb.length > 0) {
        console.log(`  ⚠️  EXTRAS EN BD (${extraInDb.length}) — posibles migraciones huérfanas o renombradas:`);
        for (const f of extraInDb) console.log(`     - ${f}`);
      }
    }

    // 5. Verificar conflictos de orden (node-pg-migrate usa timestamps)
    console.log('\n🔍 VERIFICACIÓN DE ORDEN (node-pg-migrate):');
    try {
      const result = await pool.query(`
        SELECT name, run_on
        FROM pgmigrations
        ORDER BY run_on
      `);
      let prevTs = 0;
      for (const row of result.rows) {
        const match = row.name.match(/^(\d{14})_/);
        if (match) {
          const ts = parseInt(match[1], 10);
          if (ts < prevTs) {
            console.log(`  ⚠️  ORDEN INCORRECTO: ${row.name} (ts=${ts}) viene después de timestamp ${prevTs}`);
          }
          prevTs = ts;
        }
      }
      if (result.rows.length > 0) {
        console.log('  ✅ Orden cronológico verificado');
      }
    } catch (err) {
      if (err.code !== '42P01') throw err;
    }

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[migrations-history] Error fatal:', err.message);
  process.exit(1);
});