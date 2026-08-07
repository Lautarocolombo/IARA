/* ==================== migrate-images ====================
 * Limpia referencias de imagen rotas o subóptimas de la base de datos
 * tras la migración a Vercel Blob Storage:
 *
 *   - base64  -> ya no se usa (bloat). La imagen se borra/reemplaza tras
 *                 resubirla. Limpiar el campo evita que la tabla admin cargue
 *                 data-URIs gigantes.
 *   - local-path  -> `/uploads/...` (raw): archivo efímero, 404. Roto.
 *   - stale-local-http -> `https://<backend>/uploads/...`: archivo efímero. Roto.
 *
 * Conserva INTACTAS las URLs válidas:
 *   - blob (https://*.blob.vercel-storage.com) -> OK, no tocar
 *   - cloudinary, external-http, relative, empty -> no tocar
 *
 * Modo: dry-run por defecto. Usar --apply para ejecutar.
 *
 *   node scripts/migrate-images.js --dry-run     # (default)
 *   node scripts/migrate-images.js --apply
 */
'use strict';
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const { query, initDB } = require('../backend/src/lib/db');

function classify(url, backendUrl) {
  if (!url || String(url).trim() === '') return 'empty';
  if (typeof url !== 'string') return 'other';
  var u = url.trim();
  if (u.startsWith('data:')) return 'base64';
  if (u.includes('.blob.vercel-storage.com')) return 'blob';
  if (u.includes('res.cloudinary.com') || u.includes('cloudinary.com')) return 'cloudinary';
  if (u.startsWith('/uploads/')) return 'local-path';
  if (backendUrl && u.toLowerCase().indexOf((backendUrl.toLowerCase().replace(/\/+$/, '')) + '/uploads/') === 0) return 'stale-local-http';
  if (/^https?:\/\//i.test(u)) return 'external-http';
  if (u.startsWith('assets/') || u.startsWith('/')) return 'relative';
  return 'other';
}

const BROKEN = new Set(['base64', 'local-path', 'stale-local-http']);

const TABLES = [
  { table: 'product_images', urlCol: 'url', idCol: 'id', mode: 'delete' },
  { table: 'products', urlCol: 'image', idCol: 'id', refCol: 'name', mode: 'clear' },
  { table: 'hero_cards', urlCol: 'imagen', idCol: 'id', refCol: 'slot', mode: 'clear' },
  { table: 'categories', urlCol: 'image', idCol: 'id', refCol: 'name', mode: 'clear' },
  { table: 'testimonials', urlCol: 'image', idCol: 'id', refCol: 'name', mode: 'clear' },
  { table: 'testimonials', urlCol: 'avatar', idCol: 'id', refCol: 'name', mode: 'clear' }
];

async function run() {
  var doApply = process.argv.indexOf('--apply') !== -1;
  await initDB().catch(function (e) { console.error('initDB aviso:', e.message); });
  var backendUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';

  var plan = [];
  for (var i = 0; i < TABLES.length; i++) {
    var t = TABLES[i];
    var rows;
    try {
      rows = (await query('SELECT ' + t.idCol + ', ' + (t.refCol ? t.refCol + ', ' : '') + t.urlCol + ' FROM ' + t.table)).rows || [];
    } catch (err) {
      console.error('Error leyendo ' + t.table + ': ' + err.message);
      continue;
    }
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j];
      var url = row[t.urlCol];
      var type = classify(url, backendUrl);
      if (BROKEN.has(type)) {
        plan.push({ table: t.table, idCol: t.idCol, id: row[t.idCol], refCol: t.refCol, ref: row[t.refCol], urlCol: t.urlCol, mode: t.mode, type: type, url: url });
      }
    }
  }

  console.log('\n=== MIGRACIÓN DE IMÁGENES ROTAS ===\n');
  console.log('Modo: ' + (doApply ? 'APLICAR (escribe en DB)' : 'DRY-RUN (solo muestra)'));
  console.log('Registros afectados: ' + plan.length);
  console.log('');

  if (!plan.length) {
    console.log('Nada que migrar. Todas las imágenes son URLs duraderas (Blob/Cloudinary/external).');
    console.log('');
    return;
  }

  for (var k = 0; k < plan.length; k++) {
    var p = plan[k];
    var label = p.ref != null ? p.ref : p.id;
    console.log('  [' + p.type + '] ' + p.table + '.' + p.urlCol + ' id=' + p.id + ' ref="' + label + '"');
    console.log('      ' + (p.url ? String(p.url).slice(0, 100) : '(vacío)'));
  }

  if (!doApply) {
    console.log('\n(Para aplicar: node scripts/migrate-images.js --apply)');
    console.log('');
    return;
  }

  var byTable = {};
  for (var m = 0; m < plan.length; m++) {
    var pp = plan[m];
    (byTable[pp.table] = byTable[pp.table] || []).push(pp);
  }

  var totalCleaned = 0;
  for (var tbl in byTable) {
    var items = byTable[tbl];
    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      if (it.mode === 'delete') {
        await query('DELETE FROM ' + it.table + ' WHERE ' + it.idCol + ' = $1', [it.id]);
      } else {
        await query('UPDATE ' + it.table + ' SET ' + it.urlCol + " = '' WHERE " + it.idCol + ' = $1 AND (' + it.urlCol + " LIKE 'data:image%' OR " + it.urlCol + " LIKE '/uploads/%' OR " + it.urlCol + " LIKE '%/uploads/%')", [it.id]);
      }
      totalCleaned++;
    }
  }

  console.log('\nAplicado: ' + totalCleaned + ' referencias limpiadas.');
  console.log('Volvé a subir las imágenes desde el panel para regenerarlas con URLs de Vercel Blob.');
  console.log('');
}

run().catch(function (err) {
  console.error('Error:', err);
  process.exit(1);
});
