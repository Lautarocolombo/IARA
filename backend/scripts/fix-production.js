const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const NEON_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

async function fixProduction() {
  if (!NEON_URL) {
    console.error('ERROR: NEON_DATABASE_URL o DATABASE_URL no configurada');
    process.exit(1);
  }

  console.log('Conectando a Neon para aplicar correcciones...');
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
    // 1. Eliminar producto de prueba "ff" (ID 6)
    await client.query('DELETE FROM products WHERE id = 6');
    console.log('Producto ID 6 eliminado');

    // 2. Actualizar stock y imágenes de productos
    const updates = [
      { id: 7, stock: 15, featured: true, image: '/imagenes/carrucel/1.jpg' },
      { id: 8, stock: 20, featured: false, image: '/imagenes/carrucel/2.jpg' },
      { id: 9, stock: 10, featured: false, image: '/imagenes/carrucel/3.jpg' },
      { id: 10, stock: 8, featured: true, image: '/imagenes/carrucel/4.jpg' },
      { id: 11, stock: 25, featured: false, image: '/imagenes/carrucel/5.jpg' },
      { id: 12, stock: 5, featured: false, image: '/imagenes/carrucel/1.jpg' }
    ];

    for (const p of updates) {
      await client.query('UPDATE products SET stock = $1, featured = $2, image = $3 WHERE id = $4', [p.stock, p.featured, p.image, p.id]);
      console.log(`Producto ${p.id} → stock: ${p.stock}, featured: ${p.featured}`);
    }

    // 3. Configurar pagos
    await client.query(`UPDATE payment_config SET 
      transfer_alias = 'artesaniagualeguay',
      cbu_cvu = '000000000000000000000',
      holder_name = 'Artesanía Gualeguay',
      mp_enabled = false,
      cash_enabled = false,
      shipping_cost = 200,
      free_shipping_from = 2000
      WHERE id = 1`);
    console.log('Payment config actualizado');

    // 4. Crear hero card
    await client.query(`INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot, tipo, tenant_id) 
      VALUES ('Pulsera Minimalista', '$2.500', '/imagenes/carrucel/1.jpg', '📿', 0, true, 'Pulsera Minimalista', 'Diseño único hecho a mano', 'Ver más', '#catalog', 0, 'hero', 'default')
      ON CONFLICT DO NOTHING`);
    console.log('Hero card creada');

    // 5. Agregar reseñas
    const reviews = [
      { name: 'María G.', rating: 5, comment: 'Las pulseras son hermosas y el envío fue rapidísimo. Volveré a comprar!', product_id: 7 },
      { name: 'Juan P.', rating: 5, comment: 'Compré un regalo y quedaron encantados. La calidad es increíble.', product_id: 8 },
      { name: 'Ana L.', rating: 4, comment: 'Muy lindo trabajo artesanal. Se nota el cuidado en cada detalle.', product_id: 9 }
    ];

    for (const r of reviews) {
      await client.query('INSERT INTO reviews (name, rating, comment, product_id, tenant_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [r.name, r.rating, r.comment, r.product_id, 'default']);
      console.log(`Reseña creada: ${r.name}`);
    }

    // 6. Cargar texto "Sobre Nosotros"
    await client.query(`INSERT INTO site_texts (key, value, tenant_id) VALUES ('about_text', '<p>En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.</p><p>Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.</p>', 'default') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    console.log('About text cargado');

    // 7. Cargar imágenes del about
    const aboutImages = ['about_image_1', 'about_image_2', 'about_image_3', 'about_image_4', 'about_image_5'];
    for (let i = 0; i < aboutImages.length; i++) {
      await client.query(`INSERT INTO site_texts (key, value, tenant_id) VALUES ($1, $2, 'default') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [aboutImages[i], `/imagenes/carrucel/${i + 1}.jpg`]);
    }
    console.log('About images cargadas');

    console.log('\n=== CORRECCIONES APLICADAS EN PRODUCCIÓN ===');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

fixProduction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
