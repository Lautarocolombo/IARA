const fs = require('fs');
const path = require('path');
const { query } = require('../lib/db');
const { isBlobConfigured, uploadToBlob } = require('../lib/upload');

(async () => {
  const dir = path.join(__dirname, '..', 'uploads', 'imagenes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const useBlob = isBlobConfigured();

  const productResult = await query('SELECT id, image FROM products WHERE image LIKE $1', ['data:image/%']);
  console.log('Productos con base64:', productResult.rows.length);

  for (const row of productResult.rows) {
    const match = row.image.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!match) continue;

    const mimeType = match[1];
    const b64 = match[2];
    const ext = mimeType.split('/')[1];
    const filename = `product_${row.id}_${Date.now()}.${ext}`;
    const filepath = path.join(dir, filename);
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(filepath, buffer);

    let url = `/uploads/imagenes/${filename}`;
    if (useBlob) {
      const blobResult = await uploadToBlob({ path: filepath, originalname: filename, mimetype: mimeType, size: buffer.length });
      if (blobResult) {
        url = blobResult.url;
        try { fs.unlinkSync(filepath); } catch (e) { /* noop */ }
      }
    }

    await query('UPDATE products SET image = $1 WHERE id = $2', [url, row.id]);
    console.log('Migrado producto', row.id, '→', url);
  }

  const imagesResult = await query('SELECT id, product_id, url FROM product_images WHERE url LIKE $1', ['data:image/%']);
  console.log('Imágenes de producto con base64:', imagesResult.rows.length);

  for (const row of imagesResult.rows) {
    const match = row.url.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!match) continue;

    const mimeType = match[1];
    const b64 = match[2];
    const ext = mimeType.split('/')[1];
    const filename = `product_image_${row.id}_${Date.now()}.${ext}`;
    const filepath = path.join(dir, filename);
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(filepath, buffer);

    let url = `/uploads/imagenes/${filename}`;
    if (useBlob) {
      const blobResult = await uploadToBlob({ path: filepath, originalname: filename, mimetype: mimeType, size: buffer.length });
      if (blobResult) {
        url = blobResult.url;
        try { fs.unlinkSync(filepath); } catch (e) { /* noop */ }
      }
    }

    await query('UPDATE product_images SET url = $1 WHERE id = $2', [url, row.id]);
    console.log('Migrada imagen', row.id, 'de producto', row.product_id, '→', url);
  }

  console.log('Migration OK');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
