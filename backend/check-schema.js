const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const { query } = require('./src/lib/db');

(async () => {
  try {
    // Initialize database
    const { initDB } = require('./src/lib/db');
    await initDB();

    // Check if product_images table exists
    const tableCheck = await query("SELECT to_regclass('product_images') as exists");
    console.log('product_images table exists:', tableCheck.rows[0]?.exists);

    // Check products count
    const count = await query('SELECT COUNT(*) FROM products');
    console.log('Products count:', count.rows[0]?.count);

    // Check products schema for image column
    const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('image', 'tenant_id') ORDER BY column_name");
    console.log('Products image/tenant_id columns:', JSON.stringify(cols.rows));

    // Check product_images schema
    const imgCols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_images' ORDER BY ordinal_position");
    console.log('product_images columns:', JSON.stringify(imgCols.rows));

    // Check if any product_images rows exist
    const imgCount = await query('SELECT COUNT(*) FROM product_images');
    console.log('product_images count:', imgCount.rows[0]?.count);

    // Check products with non-empty image
    const withImages = await query("SELECT id, name, image FROM products WHERE image IS NOT NULL AND image != '' ORDER BY id LIMIT 10");
    console.log('Products with images:', withImages.rows.length);
    for (const p of withImages.rows) {
      const domain = p.image.includes('iara-peach.vercel.app') ? 'OLD' :
        p.image.includes('blob.vercel-storage.com') ? 'BLOB' :
        p.image.includes('localhost') ? 'LOCAL' :
        'OTHER';
      console.log('  Product', p.id, '(' + p.name.substring(0, 20) + '):', domain, '-', p.image.substring(0, 60));
    }

    // Check product_images rows
    const allImages = await query('SELECT id, product_id, url FROM product_images ORDER BY id LIMIT 20');
    console.log('\nProduct images:', allImages.rows.length);
    const domainCounts = {};
    for (const img of allImages.rows) {
      const domain = img.url.includes('iara-peach.vercel.app') ? 'OLD' :
        img.url.includes('blob.vercel-storage.com') ? 'BLOB' :
        img.url.includes('localhost') ? 'LOCAL' :
        img.url.includes('/uploads/') ? 'LOCAL-PATH' : 'OTHER';
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
    console.log('Image URL domains:', JSON.stringify(domainCounts));
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
