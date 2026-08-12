const { query } = require('../src/lib/db');
const logger = require('../src/lib/logger');

async function migrateTenants() {
  try {
    const result = await query('SELECT COUNT(*) AS total FROM users WHERE tenant_id IS NULL OR tenant_id = \'\'');
    const totalUsers = result.rows[0]?.total || 0;

    if (totalUsers === 0) {
      console.log('[migrate-tenants] No hay usuarios sin tenant_id');
      return;
    }

    console.log(`[migrate-tenants] Migrando ${totalUsers} usuarios...`);

    await query('UPDATE users SET tenant_id = \'default\' WHERE tenant_id IS NULL OR tenant_id = \'\'');
    console.log('[migrate-tenants] Usuarios actualizados');

    const tables = [
      'orders', 'products', 'customers', 'contacts', 'sales',
      'reviews', 'testimonials', 'payment_proofs', 'product_images',
      'categories', 'hero_cards', 'webhook_events', 'activity_log',
      'subscribers'
    ];

    for (const table of tables) {
      try {
        await query(`UPDATE ${table} SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''`);
        console.log(`[migrate-tenants] ${table} actualizada`);
      } catch (err) {
        console.warn(`[migrate-tenants] Error actualizando ${table}:`, err.message);
      }
    }

    console.log('[migrate-tenants] Migración completada');
  } catch (err) {
    console.error('[migrate-tenants] Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  migrateTenants().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrateTenants };
