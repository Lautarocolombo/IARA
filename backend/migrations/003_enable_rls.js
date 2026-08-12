'use strict';

module.exports = {
  name: '003_enable_rls',
  async up(sql) {
    const tables = [
      'orders', 'products', 'customers', 'contacts', 'sales',
      'reviews', 'testimonials', 'payment_proofs', 'product_images',
      'categories', 'hero_cards', 'webhook_events', 'activity_log',
      'subscribers'
    ];

    for (const table of tables) {
      sql`ALTER TABLE ${sql(table)} ENABLE ROW LEVEL SECURITY`;
      sql`CREATE POLICY tenant_isolation_${sql(table)} ON ${sql(table)} FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text)`;
      sql`CREATE POLICY tenant_insert_${sql(table)} ON ${sql(table)} FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text)`;
    }
  },

  async down(sql) {
    const tables = [
      'orders', 'products', 'customers', 'contacts', 'sales',
      'reviews', 'testimonials', 'payment_proofs', 'product_images',
      'categories', 'hero_cards', 'webhook_events', 'activity_log',
      'subscribers'
    ];

    for (const table of tables) {
      sql`DROP POLICY IF EXISTS tenant_insert_${sql(table)} ON ${sql(table)}`;
      sql`DROP POLICY IF EXISTS tenant_isolation_${sql(table)} ON ${sql(table)}`;
      sql`ALTER TABLE ${sql(table)} DISABLE ROW LEVEL SECURITY`;
    }
  },
};
