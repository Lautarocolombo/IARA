const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS_HASH = bcrypt.hashSync('admin', 10);
process.env.JWT_SECRET = 'e2e-only-secret';
process.env.PORT = process.env.PORT || '3000';

const { app, dbReady } = require('../../backend/src/server.js');
const { query } = require('../../backend/src/lib/db');

async function seedE2EData() {
  const categories = [
    ['Pulseras', 'pulseras', 'Pulseras artesanales'],
    ['Accesorios', 'accesorios', 'Accesorios hechos a mano'],
    ['Souvenirs', 'souvenirs', 'Souvenirs de Gualeguay']
  ];
  for (const [name, slug, description] of categories) {
    const existing = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      await query(
        'UPDATE categories SET name = $1, description = $2, active = TRUE, tenant_id = \'default\' WHERE id = $3',
        [name, description, existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO categories (name, slug, description, active, tenant_id) VALUES ($1, $2, $3, TRUE, \'default\')',
        [name, slug, description]
      );
    }
  }

  const products = [
    ['Pulsera Minimalista', 'pulsera-minimalista', 'pulseras', 4500, 'Pulsera artesanal minimalista', 12, true],
    ['Pulsera Hilo Natural', 'pulsera-hilo-natural', 'pulseras', 3800, 'Pulsera de hilo natural', 8, false],
    ['Pulsera Turquesa', 'pulsera-turquesa', 'pulseras', 5100, 'Pulsera con turquesa artesanal', 7, false],
    ['Accesorio Cerámico', 'accesorio-ceramico', 'accesorios', 5200, 'Accesorio de cerámica artesanal', 6, true],
    ['Set Artesanal', 'set-artesanal', 'accesorios', 7900, 'Set de accesorios artesanales', 10, false],
    ['Llavero Artesanal', 'llavero-artesanal', 'souvenirs', 2500, 'Llavero hecho a mano', 15, false],
    ['Souvenir Gualeguay', 'souvenir-gualeguay', 'souvenirs', 3200, 'Souvenir de nuestra ciudad', 9, false]
  ];
  for (const [name, slug, category, price, description, stock, featured] of products) {
    const existing = await query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      await query(
        'UPDATE products SET name = $1, category = $2, price = $3, description = $4, stock = $5, featured = $6, active = TRUE, deleted = FALSE, emoji = \'📿\', image = \'\', badge = \'\', sku = \'\', tenant_id = \'default\' WHERE slug = $7',
        [name, category, price, description, stock, featured, slug]
      );
    } else {
      await query(
        'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted, tenant_id) VALUES ($1, $2, $3, $4, $5, \'📿\', \'\', \'\', $6, $7, TRUE, \'\', FALSE, \'default\')',
        [name, slug, category, price, description, stock, featured]
      );
    }
  }

  await query(
    'INSERT OR IGNORE INTO orders (items, total, customer, status, shipping_name, shipping_city, subtotal, shipping_cost, payment_method, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      JSON.stringify([{ name: 'Pulsera Minimalista', price: 4500, quantity: 1, category_slug: 'pulseras' }]),
      4500,
      JSON.stringify({ name: 'Cliente Test', email: 'test@test.com' }),
      'completed',
      'Cliente Test',
      'Gualeguay',
      4500,
      500,
      'transfer',
      'default'
    ]
  );
}

async function start() {
  await dbReady;
  await seedE2EData();
  const server = app.listen(process.env.PORT, '0.0.0.0');
  server.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
