const { query } = require('./src/lib/db');

(async () => {
  try {
    // Check products table
    const products = await query("SELECT id, name, image FROM products WHERE image IS NOT NULL AND image != '' ORDER BY id");
    console.log('Products with images:', products.rows.length);
    for (const p of products.rows) {
      const domain = p.image.includes('iara-peach.vercel.app') ? 'OLD(iara-peach)' :
        p.image.includes('blob.vercel-storage.com') ? 'BLOB' :
        p.image.includes('localhost') ? 'LOCAL' :
        p.image.includes('/uploads/') ? 'LOCAL-PATH' : 'OTHER';
      console.log('  Product', p.id, '(' + p.name.substring(0, 20) + '):', domain, '-', p.image.substring(0, 60));
    }

    // Check product_images table
    const images = await query('SELECT id, product_id, url FROM product_images ORDER BY id');
    console.log('\nProduct images:', images.rows.length);
    const domainCounts = {};
    for (const img of images.rows) {
      const domain = img.url.includes('iara-peach.vercel.app') ? 'OLD(iara-peach)' :
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
