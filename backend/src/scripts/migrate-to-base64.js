const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { query } = require('../src/lib/db');
const { initDB } = require('../src/lib/db');
const sharp = require('sharp');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, buffer, contentType: res.headers['content-type'] || '' });
      });
    }).on('error', () => resolve({ status: 0, buffer: null, contentType: '' }));
  });
}

async function optimizeToWebp(buffer) {
  try {
    const webpBuffer = await sharp(buffer)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return webpBuffer;
  } catch (err) {
    console.warn('Sharp falló, usando buffer original:', err.message);
    return buffer;
  }
}

async function migrateTable(tableName, urlColumn, idColumn, extraFields = []) {
  console.log(`\n=== Migrando ${tableName} ===`);
  const result = await query(`SELECT ${idColumn}, ${urlColumn}${extraFields.length ? ', ' + extraFields.join(', ') : ''} FROM ${tableName} WHERE ${urlColumn} IS NOT NULL AND ${urlColumn} != '' ORDER BY ${idColumn}`);
  const rows = result.rows || [];
  console.log(`Encontradas ${rows.length} filas con imágenes`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const currentUrl = row[urlColumn];
    if (!currentUrl) continue;

    if (currentUrl.startsWith('data:image/')) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${tableName}.${row[idColumn]}: ${currentUrl.substring(0, 80)}`);
      migrated++;
      continue;
    }

    try {
      let buffer = null;

      if (currentUrl.startsWith('http')) {
        const fetched = await fetchUrl(currentUrl);
        if (fetched.status === 200 && fetched.buffer && fetched.buffer.length > 0) {
          buffer = fetched.buffer;
        }
      } else if (currentUrl.startsWith('/')) {
        const fsPath = path.join(__dirname, '..', '..', 'frontend', currentUrl);
        if (fs.existsSync(fsPath)) {
          buffer = fs.readFileSync(fsPath);
        }
      } else if (fs.existsSync(currentUrl)) {
        buffer = fs.readFileSync(currentUrl);
      }

      if (!buffer) {
        console.log(`  SKIP (no encontrado): ${tableName}.${row[idColumn]}: ${currentUrl.substring(0, 60)}`);
        skipped++;
        continue;
      }

      const webpBuffer = await optimizeToWebp(buffer);
      const base64 = webpBuffer.toString('base64');
      const dataUri = 'data:image/webp;base64,' + base64;

      const setParts = [urlColumn];
      const values = [dataUri];
      extraFields.forEach((f) => {
        setParts.push(f);
        values.push(row[f] || '');
      });
      values.push(row[idColumn]);

      await query(`UPDATE ${tableName} SET ${setParts.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE ${idColumn} = $${values.length}`, values);

      console.log(`  OK: ${tableName}.${row[idColumn]} → base64 (${dataUri.length} chars)`);
      migrated++;
    } catch (err) {
      console.log(`  ERROR: ${tableName}.${row[idColumn]}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Resultado: ${migrated} migrados, ${skipped} omitidos, ${failed} errores`);
  return { migrated, skipped, failed };
}

(async () => {
  try {
    await initDB();

    console.log('=== Migración de imágenes a base64 en PostgreSQL ===');
    console.log('Modo:', DRY_RUN ? 'DRY RUN (sin cambios)' : 'APLICAR CAMBIOS');

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const tables = [
      { table: 'product_images', url: 'url', id: 'id', extra: ['filename', 'cloudinary_public_id'] },
      { table: 'products', url: 'image', id: 'id', extra: [] },
      { table: 'carousel_images', url: 'url', id: 'id', extra: ['public_id'] },
      { table: 'hero_cards', url: 'imagen', id: 'id', extra: [] }
    ];

    for (const t of tables) {
      const result = await migrateTable(t.table, t.url, t.id, t.extra);
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
      totalFailed += result.failed;
    }

    // Migrar site_texts que contengan URLs de imagen
    console.log('\n=== Migrando site_texts ===');
    const textsResult = await query("SELECT key, value FROM site_texts WHERE value LIKE '%/imagenes/%' OR value LIKE '%iara-peach%' OR value LIKE '%uploads/imagenes%' OR value LIKE 'http%'");
    const textRows = textsResult.rows || [];
    console.log(`Encontrados ${textRows.length} registros con URLs de imagen`);

    for (const row of textRows) {
      const oldVal = row.value;
      if (!oldVal || oldVal.startsWith('data:image/')) {
        totalSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] site_texts.${row.key}: ${oldVal.substring(0, 80)}`);
        totalMigrated++;
        continue;
      }

      try {
        let buffer = null;
        if (oldVal.startsWith('http')) {
          const fetched = await fetchUrl(oldVal);
          if (fetched.status === 200 && fetched.buffer && fetched.buffer.length > 0) {
            buffer = fetched.buffer;
          }
        } else if (oldVal.startsWith('/')) {
          const fsPath = path.join(__dirname, '..', '..', 'frontend', oldVal);
          if (fs.existsSync(fsPath)) {
            buffer = fs.readFileSync(fsPath);
          }
        }

        if (!buffer) {
          console.log(`  SKIP: site_texts.${row.key}`);
          totalSkipped++;
          continue;
        }

        const webpBuffer = await optimizeToWebp(buffer);
        const base64 = webpBuffer.toString('base64');
        const dataUri = 'data:image/webp;base64,' + base64;

        await query('UPDATE site_texts SET value = $1 WHERE key = $2', [dataUri, row.key]);
        console.log(`  OK: site_texts.${row.key} → base64 (${dataUri.length} chars)`);
        totalMigrated++;
      } catch (err) {
        console.log(`  ERROR: site_texts.${row.key}: ${err.message}`);
        totalFailed++;
      }
    }

    console.log('\n=== MIGRACIÓN COMPLETA ===');
    console.log(`Total migrados: ${totalMigrated}`);
    console.log(`Total omitidos: ${totalSkipped}`);
    console.log(`Total errores: ${totalFailed}`);

    if (DRY_RUN) {
      console.log('\nEsto fue un DRY RUN. Ejecutá sin DRY_RUN para aplicar cambios.');
      console.log('Ejemplo: node src/scripts/migrate-to-base64.js');
    }
  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  }
})();
