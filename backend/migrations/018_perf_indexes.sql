-- 018_perf_indexes: índices para filtros del panel admin (productos/pedidos/comprobantes).
-- Idempotente: todos con IF NOT EXISTS. Bajo costo, alto impacto en listados.
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(active, category);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status_created ON payment_proofs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_texts_key ON site_texts(key);
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_resolved ON inventory_alerts(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_active_orden ON testimonials(active, orden);
CREATE INDEX IF NOT EXISTS idx_categories_active_orden ON categories(active, orden);
CREATE INDEX IF NOT EXISTS idx_product_images_product_orden ON product_images(product_id, orden);
