const { initDB, query } = require('./backend/src/lib/db');

(async () => {
  try {
    await initDB();
    const r = await query("SELECT id, name, image FROM products WHERE image LIKE '/uploads/%' OR image LIKE '/imagenes/%' ORDER BY id");
    console.log('Products with local paths:', r.rows.length);
    r.rows.forEach(p => console.log(`  ${p.id}: ${p.name} -> ${p.image}`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
})();
