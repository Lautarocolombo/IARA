/* ==================== find-broken-images ====================
 * Diagnostica el estado de las imágenes almacenadas en la base de
 * datos (productos, galería de productos, hero cards, categorías y
 * testimonios) y reporta cuáles quedaron rotas o subóptimas tras la
 * migración al filesystem local/efímero.
 *
 * Uso:
 *   node scripts/find-broken-images.js                 # usa backend/.env (local SQLite)
 *   DATABASE_URL=postgres://... node scripts/find-broken-images.js   # producción
 *
 * Clasificación:
 *   blob            -> OK (Vercel Blob, durable). No requiere acción.
 *   cloudinary      -> OK (si la cuenta sigue activa).
 *   external-http   -> OK (URL pega). Verificar manualmente.
 *   base64          -> SUBIR DE NUEVO (bloat de DB, frágil, no escalable).
 *   local-path      -> ROTO (path relativo /uploads/... sin resolver -> '').
 *   stale-local-http-> ROTO (URL http://.../uploads/... a filesystem efímero).
 *   empty           -> Sin imagen (no requiere acción a menos que esté incompleto).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

let query, initDB;
try {
  ({ query, initDB } = require('../backend/src/lib/db'));
} catch (err) {
  console.error('No se pudo cargar el gestor de base de datos:', err.message);
  process.exit(1);
}

function classify(url, backendUrl) {
  if (!url || String(url).trim() === '') return 'empty';
  if (typeof url !== 'string') return 'other';
  var u = url.trim();
  if (u.startsWith('data:')) return 'base64';
  if (u.includes('.blob.vercel-storage.com')) return 'blob';
  if (u.includes('res.cloudinary.com') || u.includes('cloudinary.com')) return 'cloudinary';
  if (u.startsWith('/uploads/')) return 'local-path';
  if (backendUrl && u.toLowerCase().startsWith(backendUrl.toLowerCase() + '/uploads/')) return 'stale-local-http';
  if (/^https?:\/\//i.test(u)) return 'external-http';
  if (u.startsWith('assets/') || u.startsWith('/')) return 'relative';
  return 'other';
}

const NEEDS_RESUBMIT = new Set(['base64', 'local-path', 'stale-local-http']);

const TABLES = [
  { table: 'product_images', urlCol: 'url', idCol: 'id', extra: 'CONCAT(product_id) AS ref' },
  { table: 'products', urlCol: 'image', idCol: 'id', extra: 'name AS ref' },
  { table: 'hero_cards', urlCol: 'imagen', idCol: 'id', extra: 'slot AS ref' },
  { table: 'categories', urlCol: 'image', idCol: 'id', extra: 'name AS ref' },
  { table: 'testimonials', urlCol: 'image', idCol: 'id', extra: 'name AS ref' }
];

function pad(n, w) { var s = String(n); while (s.length < w) s = ' ' + s; return s; }

async function run() {
  await initDB().catch(function (e) { console.error('initDB aviso:', e.message); });

  var backendUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';

  var total = 0;
  var byType = Object.create(null);
  var needsResubmit = [];

  for (var t = 0; t < TABLES.length; t++) {
    var tbl = TABLES[t];
    var rows;
    try {
      rows = (await query('SELECT ' + tbl.idCol + ', ' + tbl.urlCol + ', ' + tbl.extra + ' FROM ' + tbl.table)).rows || [];
    } catch (err) {
      console.error('Error leyendo ' + tbl.table + ': ' + err.message);
      continue;
    }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var raw = row[tbl.urlCol];
      var type = classify(raw, backendUrl);
      total++;
      byType[type] = (byType[type] || 0) + 1;
      if (NEEDS_RESUBMIT.has(type)) {
        needsResubmit.push({
          table: tbl.table,
          id: row[tbl.idCol],
          ref: row.ref != null ? String(row.ref) : '',
          type: type,
          url: raw ? String(raw).slice(0, 120) : ''
        });
      }
    }
  }

  console.log('\n=== REPORTE DE IMÁGENES EN BASE DE DATOS ===\n');
  console.log('Total de referencias escaneadas: ' + total);
  console.log('');
  console.log('Distribución por tipo:');
  var types = Object.keys(byType).sort();
  for (var k = 0; k < types.length; k++) {
    console.log('  ' + pad(byType[types[k]], 6) + ' ' + types[k]);
  }

  var okCount = (byType.blob || 0) + (byType.cloudinary || 0) + (byType['external-http'] || 0);
  var brokenCount = needsResubmit.length;

  console.log('\n  OK (duraderas): ' + okCount);
  console.log('  NECESITAN RESUBIRSE: ' + brokenCount);

  if (needsResubmit.length > 0) {
    console.log('\n--- Imágenes que deben resubirse ---');
    for (var n = 0; n < needsResubmit.length; n++) {
      var r = needsResubmit[n];
      console.log('  [' + pad(r.type, 15) + '] ' + r.table + ' id=' + r.id + ' ref="' + r.ref + '"');
      console.log('      url: ' + (r.url || '(vacío)'));
    }

    console.log('\n--- SQL para identificarlas directamente ---');
    console.log('Productos cuyo products.image es base64 (bloatean la tabla admin):');
    console.log("  SELECT id, name FROM products WHERE image LIKE 'data:image%';");
    console.log('');
    console.log('product_images rotas (path local o base64):');
    console.log("  SELECT id, product_id, url FROM product_images");
    console.log("   WHERE url LIKE '/uploads/%' OR url LIKE 'data:image%'");
    console.log("     OR url LIKE 'https://api.artesaniagualeguay.com/uploads/%';");
    console.log('');
    console.log('hero_cards / categories / testimonials con storage efímero:');
    console.log("  SELECT id, imagen FROM hero_cards WHERE imagen LIKE '/uploads/%' OR imagen LIKE 'data:image%';");
    console.log('  (categorías y testimonios: repetir para la columna image)');
  } else {
    console.log('\nNo se encontraron imágenes rotas ni con base64. ¡Todo migrado a URLs duraderas!');
  }

  console.log('\n(Si BLOB_READ_WRITE_TOKEN no está seteado en producción, configúralo y re-subí las imágenes rotas.)');
  console.log('');
}

run().catch(function (err) {
  console.error('Error ejecutando el diagnóstico:', err);
  process.exit(1);
});
