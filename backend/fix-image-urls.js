const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { query } = require('./src/lib/db');
const { initDB } = require('./src/lib/db');
const { isBlobUrl } = require('./src/lib/upload');

(async () => {
  try {
    await initDB();

    // 1. Find and report all images with old/non-blob URLs
    const allImages = await query('SELECT id, product_id, url FROM product_images ORDER BY id');
    console.log('Total product_images:', allImages.rows.length);

    for (const img of allImages.rows) {
      const isBlob = img.url.includes('blob.vercel-storage.com');
      const urlType = isBlob ? 'BLOB' : img.url.includes('iara-peach') ? 'OLD(iara-peach)' : 'OTHER';
      console.log('  Image', img.id, '| product', img.product_id, '| type:', urlType, '| url:', img.url.substring(0, 80));
    }

    // 2. Delete old non-blob images (images that point to broken URLs)
    const deleteResult = await query("DELETE FROM product_images WHERE url NOT LIKE '%blob.vercel-storage.com%' AND url LIKE '%iara-peach%';");
    console.log('\nDeleted old non-blob image rows:', deleteResult.rowCount);

    // 3. Update products.image to point to the first blob URL (or empty if no blob URLs)
    const products = await query('SELECT id, name, image FROM products WHERE image IS NOT NULL AND image != \'\'');
    console.log('Products with image set:', products.rows.length);

    for (const p of products.rows) {
      const oldImage = p.image;
      const isOldUrl = oldImage.includes('iara-peach.vercel.app') || (oldImage.startsWith('/uploads/') && !oldImage.includes('blob.vercel-storage.com'));

      if (isOldUrl) {
        // Find the first blob URL for this product
        const blobResult = await query(
          'SELECT url FROM product_images WHERE product_id = $1 AND url LIKE \'%blob.vercel-storage.com%\' ORDER BY orden ASC, id ASC LIMIT 1',
          [p.id]
        );

        if (blobResult.rows.length > 0) {
          // Update to the blob URL
          await query('UPDATE products SET image = $1 WHERE id = $2', [blobResult.rows[0].url, p.id]);
          console.log('  Product', p.id, '(' + p.name + '): Updated old URL to blob URL:', blobResult.rows[0].url.substring(0, 60));
        } else {
          // No blob URL found, clear the image
          await query('UPDATE products SET image = \'\' WHERE id = $1', [p.id]);
          console.log('  Product', p.id, '(' + p.name + '): Cleared old broken URL (no blob URL available)');
        }
      }
    }

    // 4. Verify the final state
    const finalProducts = await query('SELECT id, name, image FROM products WHERE image IS NOT NULL AND image != \'\' ORDER BY id');
    console.log('\n=== Final state ===');
    for (const p of finalProducts.rows) {
      const isBlob = p.image.includes('blob.vercel-storage.com');
      console.log('  Product', p.id, '(' + p.name + '):', isBlob ? 'BLOB' : 'OLD', '-', p.image.substring(0, 60));
    }

    const finalImages = await query('SELECT id, product_id, url FROM product_images ORDER BY id');
    console.log('\nFinal product_images:', finalImages.rows.length);
    for (const img of finalImages.rows) {
      const isBlob = img.url.includes('blob.vercel-storage.com');
      console.log('  Image', img.id, '| product', img.product_id, '| type:', isBlob ? 'BLOB' : 'OLD', '| url:', img.url.substring(0, 80));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
