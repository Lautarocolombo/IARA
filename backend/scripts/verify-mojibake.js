#!/usr/bin/env node
/**
 * verify-mojibake.js — Detección de mojibake (UTF-8 mal decodificado) en Neon
 *
 * Uso:
 *   DATABASE_URL=postgresql://... node scripts/verify-mojibake.js
 *   DRY_RUN=true DATABASE_URL=... node scripts/verify-mojibake.js  (solo reporte)
 *
 * Detecta patrones típicos de mojibake en columnas de texto:
 *   Ã¡  -> á    (latin1 leído como utf8)
 *   Ã©  -> é
 *   Ã±  -> ñ
 *   Ã³  -> ó
 *   Ãº  -> ú
 *   Ã  -> à
 *   Ã¢  -> â
 *   Ã¨  -> è
 *   Ãª  -> ê
 *   Ã®  -> î
 *   Ã¬  -> ì
 *   Ã²  -> ò
 *   Ã´  -> ô
 *   Ã¹  -> ù
 *   Ã»  -> û
 *   Ã¼  -> ü
 *   Ã  -> Á
 *   Ã‰  -> É
 *   Ã'  -> Ñ
 *   Ã"  -> Ó
 *   Ãš  -> Ú
 *   Â¿  -> ¿
 *   Â¡  -> ¡
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const MOJIBAKE_PATTERNS = [
  // minúsculas con tilde
  { bad: 'Ã¡', good: 'á' },
  { bad: 'Ã©', good: 'é' },
  { bad: 'Ã­', good: 'í' },
  { bad: 'Ã³', good: 'ó' },
  { bad: 'Ãº', good: 'ú' },
  { bad: 'Ã±', good: 'ñ' },
  { bad: 'Ã¼', good: 'ü' },
  { bad: 'Ã¨', good: 'è' },
  { bad: 'Ãª', good: 'ê' },
  { bad: 'Ã®', good: 'î' },
  { bad: 'Ã¬', good: 'ì' },
  { bad: 'Ã²', good: 'ò' },
  { bad: 'Ã´', good: 'ô' },
  { bad: 'Ã¹', good: 'ù' },
  { bad: 'Ã»', good: 'û' },
  { bad: 'Ã ', good: 'à' },
  { bad: 'Ã¢', good: 'â' },
  // mayúsculas con tilde
  { bad: 'Ã', good: 'Á' },
  { bad: 'Ã‰', good: 'É' },
  { bad: 'Ã', good: 'Í' },
  { bad: 'Ã"', good: 'Ó' },
  { bad: 'Ãš', good: 'Ú' },
  { bad: 'Ã', good: 'Ñ' },
  { bad: 'Ãœ', good: 'Ü' },
  // signos de puntuación español
  { bad: 'Â¿', good: '¿' },
  { bad: 'Â¡', good: '¡' },
  // euro y otros
  { bad: 'â‚¬', good: '€' },
  { bad: 'â€œ', good: '“' },
  { bad: 'â€', good: '”' },
  { bad: 'â€˜', good: '‘' },
  { bad: 'â€™', good: '’' },
  { bad: 'â€¢', good: '•' },
  { bad: 'â€"', good: '—' },
  { bad: 'â€"', good: '–' },
];

const TABLES_TO_CHECK = [
  { table: 'products', columns: ['name', 'description', 'category', 'sku'] },
  { table: 'orders', columns: ['shipping_name', 'shipping_address', 'shipping_city', 'notes', 'customer'] },
  { table: 'order_items', columns: ['name'] },
  { table: 'payment_proofs', columns: ['customer_name', 'rejection_reason'] },
  { table: 'receipts', columns: ['filename'] },
  { table: 'customers', columns: ['name', 'address', 'city', 'notes'] },
  { table: 'site_texts', columns: ['key', 'value'] },
  { table: 'site_settings', columns: ['key', 'value'] },
  { table: 'hero_cards', columns: ['nombre', 'titulo', 'subtitulo', 'descripcion', 'cta_texto'] },
  { table: 'testimonials', columns: ['name', 'comment', 'role'] },
  { table: 'reviews', columns: ['name', 'comment'] },
  { table: 'contacts', columns: ['name', 'email', 'message'] },
  { table: 'subscribers', columns: ['email'] },
  { table: 'carousel_images', columns: ['caption', 'alt_text'] },
  { table: 'section_content', columns: ['title', 'content'] },
  { table: 'users', columns: ['username', 'email'] },
  { table: 'coupons', columns: ['code'] },
  { table: 'shipping_rates_by_province', columns: ['province'] },
];

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
  return new Pool(options);
}

function buildPatternRegex() {
  const badChars = MOJIBAKE_PATTERNS.map(p => p.bad).join('|');
  return new RegExp(`(${badChars})`, 'g');
}

function detectMojibake(text) {
  if (!text || typeof text !== 'string') return [];
  const regex = buildPatternRegex();
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[0]);
  }
  return [...new Set(matches)];
}

function suggestCorrection(text) {
  let corrected = text;
  for (const { bad, good } of MOJIBAKE_PATTERNS) {
    corrected = corrected.split(bad).join(good);
  }
  return corrected;
}

async function checkTable(pool, table, columns) {
  const cols = columns.map(c => `"${c}"`).join(', ');
  const query = `SELECT id, ${cols} FROM "${table}"`;
  const result = await pool.query(query);

  const issues = [];
  for (const row of result.rows) {
    for (const col of columns) {
      const value = row[col];
      if (value && typeof value === 'string') {
        const detected = detectMojibake(value);
        if (detected.length > 0) {
          issues.push({
            table,
            id: row.id,
            column: col,
            original: value,
            detectedPatterns: detected,
            suggested: suggestCorrection(value),
          });
        }
      } else if (value && typeof value === 'object') {
        // JSONB columns (customer, items, etc.)
        const jsonStr = JSON.stringify(value);
        const detected = detectMojibake(jsonStr);
        if (detected.length > 0) {
          issues.push({
            table,
            id: row.id,
            column: col,
            original: jsonStr,
            detectedPatterns: detected,
            suggested: suggestCorrection(jsonStr),
          });
        }
      }
    }
  }
  return issues;
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  console.log(`[mojibake] Iniciando verificación ${dryRun ? '(DRY_RUN - solo reporte)' : '(con corrección automática)'}`);
  console.log('[mojibake] Patrones a detectar:', MOJIBAKE_PATTERNS.length);

  const pool = createPool();
  try {
    const allIssues = [];

    for (const { table, columns } of TABLES_TO_CHECK) {
      try {
        const issues = await checkTable(pool, table, columns);
        if (issues.length > 0) {
          console.log(`\n[mojibake] ⚠️  ${table}: ${issues.length} fila(s) con mojibake detectado`);
          allIssues.push(...issues);
        } else {
          console.log(`[mojibake] ✅ ${table}: sin mojibake`);
        }
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`[mojibake] ⏭️  ${table}: tabla no existe, se omite`);
        } else {
          console.error(`[mojibake] ❌ Error en ${table}:`, err.message);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`[mojibake] RESUMEN: ${allIssues.length} problema(s) total en ${allIssues.length ? [...new Set(allIssues.map(i => i.table))].length : 0} tabla(s)`);

    if (allIssues.length === 0) {
      console.log('[mojibake] ✅ No se detectó mojibake en ninguna tabla');
      return;
    }

    // Agrupar por tabla para reporte
    const byTable = allIssues.reduce((acc, issue) => {
      if (!acc[issue.table]) acc[issue.table] = [];
      acc[issue.table].push(issue);
      return acc;
    }, {});

    for (const [table, issues] of Object.entries(byTable)) {
      console.log(`\n📋 ${table} (${issues.length} filas):`);
      for (const issue of issues.slice(0, 5)) { // mostrar solo primeras 5
        console.log(`  - id=${issue.id} col="${issue.column}"`);
        console.log(`    detectado: ${issue.detectedPatterns.join(', ')}`);
        console.log(`    original:  ${issue.original.substring(0, 100)}${issue.original.length > 100 ? '...' : ''}`);
        console.log(`    sugerido:  ${issue.suggested.substring(0, 100)}${issue.suggested.length > 100 ? '...' : ''}`);
      }
      if (issues.length > 5) {
        console.log(`  ... y ${issues.length - 5} fila(s) más`);
      }
    }

    if (!dryRun && allIssues.length > 0) {
      console.log('\n[mojibake] ⚠️  Modo corrección NO implementado automáticamente por seguridad.');
      console.log('[mojibake] Para corregir, ejecutar UPDATEs manuales por tabla/columna:');
      for (const [table, issues] of Object.entries(byTable)) {
        const cols = [...new Set(issues.map(i => i.column))];
        for (const col of cols) {
          let updateSql = `UPDATE "${table}" SET "${col}" = regexp_replace("${col}", `;
          const replacements = MOJIBAKE_PATTERNS.map(p => `'${p.bad}', '${p.good}', 'g'`).join('), ');
          updateSql += replacements + ') WHERE ';
          updateSql += cols.map(c => `"${c}" ~ '${MOJIBAKE_PATTERNS.map(p => p.bad).join('|')}'`).join(' OR ');
          updateSql += ';';
          console.log(`  -- ${table}.${col}:`);
          console.log(`  ${updateSql}`);
        }
      }
    }

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[mojibake] Error fatal:', err.message);
  process.exit(1);
});