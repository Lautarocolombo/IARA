-- Migración 023: Índices compuestos para consultas frecuentes
-- Basado en análisis de queries reales en controladores

-- products: listados con filtro active + category
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(active, category) WHERE active = TRUE;

-- orders: listados por status + fecha
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);

-- site_texts: búsquedas por key
CREATE INDEX IF NOT EXISTS idx_site_texts_key ON site_texts(key);

-- order_items: joins con orders
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- activity_log: búsquedas por fecha y order relacionado
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_related_order ON activity_log(related_order_id);

-- products: búsqueda por featured
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = TRUE;

-- webhook_events: filtrado por status
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

-- carousel_images: ordenamiento
CREATE INDEX IF NOT EXISTS idx_carousel_images_orden ON carousel_images(orden) WHERE orden > 0;

-- hero_cards: slot único
CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_cards_slot ON hero_cards(slot) WHERE slot > 0;

-- orders: order_token para lookups rápidos
CREATE INDEX IF NOT EXISTS idx_orders_order_token ON orders(order_token);

-- product_images: por producto
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- testimonials: por activo
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active) WHERE active = TRUE;