'use strict';

module.exports = {
  name: '002_add_multi_tenancy',
  async up(sql) {
    sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;

    sql`CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id)`;
    sql`CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id)`;
    sql`CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id)`;
    sql`CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id)`;

    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`;
    sql`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`;
  },

  async down(sql) {
    sql`DROP INDEX IF EXISTS idx_users_tenant_id`;
    sql`ALTER TABLE users DROP COLUMN IF EXISTS tenant_id`;

    sql`DROP INDEX IF EXISTS idx_contacts_tenant_id`;
    sql`DROP INDEX IF EXISTS idx_customers_tenant_id`;
    sql`DROP INDEX IF EXISTS idx_products_tenant_id`;
    sql`DROP INDEX IF EXISTS idx_orders_tenant_id`;

    sql`ALTER TABLE activity_log DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE webhook_events DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE hero_cards DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE categories DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE product_images DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE payment_proofs DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE testimonials DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE reviews DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE sales DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE contacts DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE customers DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE products DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE orders DROP COLUMN IF EXISTS tenant_id`;
    sql`ALTER TABLE subscribers DROP COLUMN IF EXISTS tenant_id`;
  },
};
