-- Script de reparación para el conflicto de migraciones
-- Ejecutar en la base de datos de producción (Neon/Postgres) si el backend no levanta
-- por conflicto de orden de migraciones.
-- USA LA TABLA pgmigrations (la que usa node-pg-migrate), NO "migrations".

-- 1. Asegurar que la tabla de migraciones existe (node-pg-migrate la crea automáticamente)
CREATE TABLE IF NOT EXISTS pgmigrations (
  name TEXT PRIMARY KEY,
  run_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Si la tabla "orders" ya existe pero "001_init_schema.sql" NO está marcada como aplicada,
--    significa que las tablas se crearon manualmente o por otro medio.
--    Marcar "001_init_schema.sql" como aplicada para evitar que el migrador intente recrearlas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders')
     AND NOT EXISTS (SELECT 1 FROM pgmigrations WHERE name = '001_init_schema.sql') THEN
    INSERT INTO pgmigrations (name, run_on) VALUES ('001_init_schema.sql', CURRENT_TIMESTAMP);
    RAISE NOTICE 'Migración 001_init_schema.sql marcada como aplicada.';
  END IF;
END $$;

-- 3. Si existe un registro huérfano "001_add_order_token" (de una versión anterior del sistema),
--    eliminarlo para evitar conflictos de orden.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pgmigrations WHERE name = '001_add_order_token') THEN
    DELETE FROM pgmigrations WHERE name = '001_add_order_token';
    RAISE NOTICE 'Registro huérfano "001_add_order_token" eliminado.';
  END IF;
END $$;

-- 4. Marcar como aplicadas todas las migraciones que ya están reflejadas en el esquema.
--    Esto evita que el migrador intente ejecutarlas nuevamente.
--    NOTA: Los nombres deben coincidir EXACTAMENTE con los nombres de archivo actuales.
INSERT INTO pgmigrations (name, run_on) VALUES
  ('002_add_multi_tenancy.sql', CURRENT_TIMESTAMP),
  ('003_add_missing_columns.sql', CURRENT_TIMESTAMP),
  ('004_enable_rls.sql', CURRENT_TIMESTAMP),
  ('005_add_orders_missing_columns.sql', CURRENT_TIMESTAMP),
  ('006_add_coupons.sql', CURRENT_TIMESTAMP),
  ('007_add_order_coupon_fields.sql', CURRENT_TIMESTAMP),
  ('008_shipping_rates.sql', CURRENT_TIMESTAMP),
  ('009_add_users_last_login.sql', CURRENT_TIMESTAMP),
  ('010_carousel_images.sql', CURRENT_TIMESTAMP),
  ('011_section_content.sql', CURRENT_TIMESTAMP),
  ('012_add_carousel_fields.sql', CURRENT_TIMESTAMP),
  ('013_fix_utf8_encoding.sql', CURRENT_TIMESTAMP),
  ('014_fix_remaining_encoding.sql', CURRENT_TIMESTAMP),
  ('015_inventory_tables.sql', CURRENT_TIMESTAMP),
  ('016_add_testimonials_product_image.sql', CURRENT_TIMESTAMP),
  ('017_add_site_texts_tenant_id.sql', CURRENT_TIMESTAMP),
  ('018_consolidate_testimonial_image.sql', CURRENT_TIMESTAMP),
  ('019_add_hero_cards_descripcion.sql', CURRENT_TIMESTAMP),
  ('020_add_order_receipt_url.sql', CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- 5. Verificación: mostrar el estado actual de las migraciones
SELECT name, run_on FROM pgmigrations ORDER BY name;