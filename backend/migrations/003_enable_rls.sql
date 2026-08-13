ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_orders ON orders FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_orders ON orders FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_products ON products FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_products ON products FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_customers ON customers FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_customers ON customers FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_contacts ON contacts FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_contacts ON contacts FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sales ON sales FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_sales ON sales FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_reviews ON reviews FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_reviews ON reviews FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_testimonials ON testimonials FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_testimonials ON testimonials FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment_proofs ON payment_proofs FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_payment_proofs ON payment_proofs FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_product_images ON product_images FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_product_images ON product_images FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_categories ON categories FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_categories ON categories FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE hero_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_hero_cards ON hero_cards FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_hero_cards ON hero_cards FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_events ON webhook_events FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_webhook_events ON webhook_events FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_activity_log ON activity_log FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_activity_log ON activity_log FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscribers ON subscribers FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::text);
CREATE POLICY tenant_insert_subscribers ON subscribers FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::text);
