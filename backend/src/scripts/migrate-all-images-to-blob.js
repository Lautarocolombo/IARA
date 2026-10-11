const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { query } = require('../src/lib/db');
const { initDB } = require('../src/lib/db');
const { isBlobConfigured, uploadToBlob } = require('../src/lib/upload');
const logger = require('../lib/logger');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, buffer, contentType: res.headers['content-type'] || '' });
      });
    });
    req.on('error', () => resolve({ status: 0, buffer: null, contentType: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, buffer: null, contentType: '' }); });
  });
}

async function migrateTable(tableName, urlColumn, idColumn, extraUpdateFields = [], whereClause = '') {
  logger.info(`=== Migrating ${tableName} ===`);
  const result = await query(`SELECT ${idColumn}, ${urlColumn} FROM ${tableName} WHERE ${urlColumn} IS NOT NULL AND ${urlColumn} != '' ${whereClause} ORDER BY ${idColumn}`);
  const rows = result.rows || [];
  logger.info(`Found ${rows.length} rows with images in ${tableName}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const currentUrl = row[urlColumn];
    if (!currentUrl) continue;

    if (currentUrl.includes('blob.vercel-storage.com')) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      logger.info(`  [DRY] ${tableName}.${row[idColumn]}: ${currentUrl.substring(0, 60)}`);
      migrated++;
      continue;
    }

    try {
      let buffer = null;
      let contentType = 'image/webp';

      if (currentUrl.startsWith('data:image/')) {
        const match = currentUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/);
        if (match) {
          buffer = Buffer.from(match[2], 'base64');
          contentType = match[1];
        }
        if (!buffer) {
          logger.warn(`  SKIP (invalid data URI): ${tableName}.${row[idColumn]}: ${currentUrl.substring(0, 60)}`);
          skipped++;
          continue;
        }
      } else if (currentUrl.startsWith('http')) {
        const fetched = await fetchUrl(currentUrl);
        if (fetched.status === 200 && fetched.buffer && fetched.buffer.length > 0) {
          buffer = fetched.buffer;
          contentType = fetched.contentType || 'image/webp';
        }
      } else if (currentUrl.startsWith('/') && fs.existsSync(path.join(__dirname, '..', '..', 'frontend', currentUrl))) {
        buffer = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', currentUrl));
        contentType = 'image/jpeg';
      } else if (fs.existsSync(currentUrl)) {
        buffer = fs.readFileSync(currentUrl);
      }

      if (!buffer) {
        logger.warn(`  SKIP (not found): ${tableName}.${row[idColumn]}: ${currentUrl.substring(0, 60)}`);
        skipped++;
        continue;
      }

      const ext = contentType.includes('png') ? '.png' : contentType.includes('gif') ? '.gif' : '.webp';
      const safeName = `${tableName}_${row[idColumn]}_${Date.now()}${ext}`;
      const tmpPath = path.join('/tmp', safeName);
      fs.writeFileSync(tmpPath, buffer);

      const blobResult = await uploadToBlob({
        path: tmpPath,
        originalname: safeName,
        mimetype: contentType,
        size: buffer.length
      });

      try { fs.unlinkSync(tmpPath); } catch (e) { /* noop */ }

      if (!blobResult || !blobResult.url) {
        logger.error(`  FAIL (blob upload): ${tableName}.${row[idColumn]}`);
        failed++;
        continue;
      }

      const setParts = [urlColumn];
      const values = [blobResult.url];
      extraUpdateFields.forEach((f) => {
        setParts.push(f);
        values.push(row[f] || '');
      });
      values.push(row[idColumn]);

      await query(`UPDATE ${tableName} SET ${setParts.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE ${idColumn} = $${values.length}`, values);

      logger.info(`  OK: ${tableName}.${row[idColumn]} → ${blobResult.url.substring(0, 60)}`);
      migrated++;
    } catch (err) {
      logger.error({ err: err.message }, `  ERROR: ${tableName}.${row[idColumn]}`);
      failed++;
    }
  }

  logger.info(`Result: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
  return { migrated, skipped, failed };
}

(async () => {
  try {
    await initDB();

    if (!isBlobConfigured()) {
      logger.error('ERROR: BLOB_READ_WRITE_TOKEN no está configurado. Esta migración requiere Vercel Blob.');
      logger.error('Configurá el token en Render y volvé a ejecutar el script.');
      process.exit(1);
    }

    logger.info('BLOB_READ_WRITE_TOKEN detectado. Iniciando migración...');
    logger.info('DRY_RUN:', DRY_RUN);

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const pm = await migrateTable('product_images', 'url', 'id', ['filename', 'cloudinary_public_id']);
    totalMigrated += pm.migrated; totalSkipped += pm.skipped; totalFailed += pm.failed;

    const pr = await migrateTable('products', 'image', 'id', []);
    totalMigrated += pr.migrated; totalSkipped += pr.skipped; totalFailed += pr.failed;

    const cm = await migrateTable('carousel_images', 'url', 'id', ['public_id']);
    totalMigrated += cm.migrated; totalSkipped += cm.skipped; totalFailed += cm.failed;

    const hm = await migrateTable('hero_cards', 'imagen', 'id', []);
    totalMigrated += hm.migrated; totalSkipped += hm.skipped; totalFailed += hm.failed;

    logger.info('\n=== Migrating site_texts ===');
    const textsResult = await query("SELECT key, value FROM site_texts WHERE value LIKE '%/imagenes/%' OR value LIKE '%iara-peach%' OR value LIKE '%uploads/imagenes%' OR value LIKE 'http%' OR value LIKE 'data:image/%'");
    const textRows = textsResult.rows || [];
    logger.info(`Found ${textRows.length} site_texts rows with image URLs`);
    for (const row of textRows) {
      const oldVal = row.value;
      if (!oldVal || oldVal.includes('blob.vercel-storage.com')) {
        totalSkipped++;
        continue;
      }
      if (DRY_RUN) {
        logger.info(`  [DRY] site_texts.${row.key}: ${oldVal.substring(0, 60)}`);
        totalMigrated++;
        continue;
      }
      let buffer = null;
      let contentType = 'image/webp';
      if (oldVal.startsWith('data:image/')) {
        const match = oldVal.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/);
        if (match) {
          buffer = Buffer.from(match[2], 'base64');
          contentType = match[1];
        }
      } else if (oldVal.startsWith('http')) {
        const fetched = await fetchUrl(oldVal);
        if (fetched.status === 200 && fetched.buffer && fetched.buffer.length > 0) {
          buffer = fetched.buffer;
          contentType = fetched.contentType || 'image/webp';
        }
      } else if (oldVal.startsWith('/') && fs.existsSync(path.join(__dirname, '..', '..', 'frontend', oldVal))) {
        buffer = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', oldVal));
        contentType = 'image/jpeg';
      }
      if (!buffer) {
        logger.warn(`  SKIP: site_texts.${row.key}`);
        totalSkipped++;
        continue;
      }
      const ext = contentType.includes('png') ? '.png' : contentType.includes('gif') ? '.gif' : '.webp';
      const tmpPath = path.join('/tmp', `text_${row.key}_${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, buffer);
      const blobResult = await uploadToBlob({ path: tmpPath, originalname: `text_${row.key}${ext}`, mimetype: contentType, size: buffer.length });
      try { fs.unlinkSync(tmpPath); } catch (e) { /* noop */ }
      if (!blobResult || !blobResult.url) {
        logger.error(`  FAIL: site_texts.${row.key}`);
        totalFailed++;
        continue;
      }
      await query('UPDATE site_texts SET value = $1 WHERE key = $2', [blobResult.url, row.key]);
      logger.info(`  OK: site_texts.${row.key} → ${blobResult.url.substring(0, 60)}`);
      totalMigrated++;
    }

    logger.info('\n=== MIGRATION COMPLETE ===');
    logger.info(`Total migrated: ${totalMigrated}`);
    logger.info(`Total skipped: ${totalSkipped}`);
    logger.info(`Total failed: ${totalFailed}`);

    if (DRY_RUN) {
      logger.info('\nThis was a DRY RUN. Set DRY_RUN=false to apply changes.');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Migration error');
    process.exit(1);
  }
})();
