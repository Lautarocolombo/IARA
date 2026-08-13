const fs = require('fs');
const path = require('path');
const { query } = require('../lib/db');

(async () => {
  const dir = path.join(__dirname, '..', 'uploads', 'imagenes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const result = await query('SELECT id, image FROM products WHERE image LIKE $1', ['data:image/%']);
  console.log('Productos con base64:', result.rows.length);

  for (const row of result.rows) {
    const match = row.image.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!match) continue;

    const mimeType = match[1];
    const b64 = match[2];
    const ext = mimeType.split('/')[1];
    const filename = `${Date.now()}_${row.id}.${ext}`;
    const filepath = path.join(dir, filename);
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(filepath, buffer);

    const baseUrl = (process.env.BACKEND_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
    const url = `${baseUrl}/uploads/imagenes/${filename}`;
    await query('UPDATE products SET image = $1 WHERE id = $2', [url, row.id]);
    console.log('Migrado producto', row.id, '→', filename);
  }
  console.log('Migration OK');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
