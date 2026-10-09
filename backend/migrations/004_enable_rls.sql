-- Habilitar RLS en tablas principales (idempotente: DROP POLICY IF EXISTS antes de crear)
DO $$
BEGIN
  -- orders
  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
  CREATE POLICY tenant_isolation_orders ON orders FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_orders ON orders;
  CREATE POLICY tenant_insert_orders ON orders FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- products
  ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_products ON products;
  CREATE POLICY tenant_isolation_products ON products FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_products ON products;
  CREATE POLICY tenant_insert_products ON products FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- customers
  ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
  CREATE POLICY tenant_isolation_customers ON customers FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_customers ON customers;
  CREATE POLICY tenant_insert_customers ON customers FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- contacts
  ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_contacts ON contacts;
  CREATE POLICY tenant_isolation_contacts ON contacts FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_contacts ON contacts;
  CREATE POLICY tenant_insert_contacts ON contacts FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- sales
  ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_sales ON sales;
  CREATE POLICY tenant_isolation_sales ON sales FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_sales ON sales;
  CREATE POLICY tenant_insert_sales ON sales FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- reviews
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_reviews ON reviews;
  CREATE POLICY tenant_isolation_reviews ON reviews FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_reviews ON reviews;
  CREATE POLICY tenant_insert_reviews ON reviews FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- testimonials
  ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_testimonials ON testimonials;
  CREATE POLICY tenant_isolation_testimonials ON testimonials FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_testimonials ON testimonials;
  CREATE POLICY tenant_insert_testimonials ON testimonials FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- payment_proofs
  ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_payment_proofs ON payment_proofs;
  CREATE POLICY tenant_isolation_payment_proofs ON payment_proofs FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_payment_proofs ON payment_proofs;
  CREATE POLICY tenant_insert_payment_proofs ON payment_proofs FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- product_images
  ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_product_images ON product_images;
  CREATE POLICY tenant_isolation_product_images ON product_images FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_product_images ON product_images;
  CREATE POLICY tenant_insert_product_images ON product_images FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- categories
  ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_categories ON categories;
  CREATE POLICY tenant_isolation_categories ON categories FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_categories ON categories;
  CREATE POLICY tenant_insert_categories ON categories FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- hero_cards
  ALTER TABLE hero_cards ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_hero_cards ON hero_cards;
  CREATE POLICY tenant_isolation_hero_cards ON hero_cards FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_hero_cards ON hero_cards;
  CREATE POLICY tenant_insert_hero_cards ON hero_cards FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- webhook_events
  ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_webhook_events ON webhook_events;
  CREATE POLICY tenant_isolation_webhook_events ON webhook_events FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_webhook_events ON webhook_events;
  CREATE POLICY tenant_insert_webhook_events ON webhook_events FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- activity_log
  ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_activity_log ON activity_log;
  CREATE POLICY tenant_isolation_activity_log ON activity_log FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_activity_log ON activity_log;
  CREATE POLICY tenant_insert_activity_log ON activity_log FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

  -- subscribers
  ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_subscribers ON subscribers;
  CREATE POLICY tenant_isolation_subscribers ON subscribers FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
  DROP POLICY IF EXISTS tenant_insert_subscribers ON subscribers;
  CREATE POLICY tenant_insert_subscribers ON subscribers FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);
END $$;
