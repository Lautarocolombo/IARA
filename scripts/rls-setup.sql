-- ============================================================
-- ARTESANÍA GUALEGUAY — RLS + MULTI-TENANCY
-- ============================================================
-- 1. Tabla de tenants
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'Artesanía Gualeguay',
  domain TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed tenant por defecto
INSERT INTO tenants (id, name, domain, active)
VALUES ('default', 'Artesanía Gualeguay', 'artesaniagualeguay.com', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Agregar tenant_id a tablas principales
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE site_texts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE product_bulk_imports ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_tenant_id ON testimonials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hero_cards_tenant_id ON hero_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_images_tenant_id ON product_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_id ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_config_tenant_id ON payment_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_texts_tenant_id ON site_texts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_settings_tenant_id ON site_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_tenant_id ON payment_proofs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_id ON webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_tenant_id ON subscribers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id ON activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_id ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_bulk_imports_tenant_id ON product_bulk_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- 5. Habilitar RLS en tablas sensibles
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_bulk_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS: admin ve todo de su tenant, cliente ve lo suyo
-- Nota: Para simplificar, asumimos que el backend setea app.current_tenant = 'default'
--       antes de cada query. En producción, el tenant_id se obtiene del JWT o subdominio.

-- Admin policies (SELECT, INSERT, UPDATE, DELETE para su tenant)
DO $$
BEGIN
  CREATE POLICY admin_all_products ON products FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_orders ON orders FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_customers ON customers FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_categories ON categories FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_testimonials ON testimonials FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_hero_cards ON hero_cards FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_product_images ON product_images FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_sales ON sales FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_payment_config ON payment_config FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_site_texts ON site_texts FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_site_settings ON site_settings FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_contacts ON contacts FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_payment_proofs ON payment_proofs FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_webhook_events ON webhook_events FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_reviews ON reviews FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_subscribers ON subscribers FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_activity_log ON activity_log FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_receipts ON receipts FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_product_bulk_imports ON product_bulk_imports FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY admin_all_users ON users FOR ALL TO PUBLIC USING (tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
