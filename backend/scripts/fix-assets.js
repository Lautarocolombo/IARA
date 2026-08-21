const { Pool } = require('pg');

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) {
  console.error('ERROR: DATABASE_URL no está definida.');
  process.exit(1);
}

async function fixAssets() {
  const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  });

  let client;
  try {
    client = await pool.connect();
    console.log('Conectado a Neon\n');
  } catch (err) {
    console.error('Error conectando:', err.message);
    await pool.end();
    process.exit(1);
  }

  try {
    const blobImage = 'https://qv6wutytfjdt3n1u.public.blob.vercel-storage.com/products/1787187457506_3605394bbf038c78674e8c11bf4a3193.jpg';
    const carouselBase = 'https://iara-os3h.onrender.com/imagenes/carrucel';

    // Producto 7: mantener blob existente
    await client.query('UPDATE products SET image = $1 WHERE id = 7', [blobImage]);
    console.log('Producto 7 → imagen blob mantenida');

    // Productos 8-12: usar imágenes locales del carrusel
    const productImages = [
      { id: 8, image: `${carouselBase}/2.jpg` },
      { id: 9, image: `${carouselBase}/3.jpg` },
      { id: 10, image: `${carouselBase}/4.jpg` },
      { id: 11, image: `${carouselBase}/5.jpg` },
      { id: 12, image: `${carouselBase}/1.jpg` }
    ];

    for (const p of productImages) {
      await client.query('UPDATE products SET image = $1 WHERE id = $2', [p.image, p.id]);
      console.log(`Producto ${p.id} → imagen actualizada`);
    }

    // Carrusel: las 5 imágenes locales
    const carouselSlots = [
      { slot: 1, url: `${carouselBase}/1.jpg` },
      { slot: 2, url: `${carouselBase}/2.jpg` },
      { slot: 3, url: `${carouselBase}/3.jpg` },
      { slot: 4, url: `${carouselBase}/4.jpg` },
      { slot: 5, url: `${carouselBase}/5.jpg` }
    ];

    for (const s of carouselSlots) {
      await client.query(`INSERT INTO carousel_images (slot, url, tenant_id) VALUES ($1, $2, 'default') ON CONFLICT (slot, tenant_id) DO UPDATE SET url = EXCLUDED.url, updated_at = NOW()`, [s.slot, s.url]);
      console.log(`Carrusel slot ${s.slot} → imagen cargada`);
    }

    // Hero cards: 2 tarjetas con imágenes
    await client.query(`INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot, tipo, tenant_id) 
      VALUES ('Pulsera Minimalista', '$2.500', '${carouselBase}/1.jpg', '📿', 0, true, 'Pulsera Minimalista', 'Diseño único hecho a mano', 'Ver más', '#catalog', 0, 'hero', 'default')
      ON CONFLICT DO NOTHING`);
    
    await client.query(`INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot, tipo, tenant_id) 
      VALUES ('Set de Souvenirs Gualeguay', '$4.500', '${carouselBase}/4.jpg', '🎁', 1, true, 'Set de Souvenirs', 'Recuerdos de nuestra ciudad', 'Ver más', '#catalog', 1, 'hero', 'default')
      ON CONFLICT DO NOTHING`);
    
    console.log('Hero cards creadas');

    console.log('\n=== ACTIVOS ACTUALIZADOS ===');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

fixAssets().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
