-- Script de reparación para el conflicto de migraciones (legacy, mantenido como red seguridad)
-- Ejecutar en la base de datos de producción (Neon/Postgres) si el backend no levanta
-- por conflicto de orden de migraciones.

-- 1. Asegurar que la tabla de migraciones existe
CREATE TABLE IF NOT EXISTS migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Si la tabla "orders" ya existe pero "001_init_schema" NO está marcada como aplicada,
--    significa que las tablas se crearon manualmente o por otro medio.
--    Marcar "001_init_schema" como aplicada para evitar que el migrador intente recrearlas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders')
     AND NOT EXISTS (SELECT 1 FROM migrations WHERE name = '001_init_schema') THEN
    INSERT INTO migrations (name, applied_at) VALUES ('001_init_schema', CURRENT_TIMESTAMP);
    RAISE NOTICE 'Migración 001_init_schema marcada como aplicada.';
  END IF;
END $$;

-- 3. Si existe un registro huérfano "001_add_order_token" (de una versión anterior del sistema),
--    renombrarlo o eliminarlo para evitar conflictos de orden.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM migrations WHERE name = '001_add_order_token') THEN
    DELETE FROM migrations WHERE name = '001_add_order_token';
    RAISE NOTICE 'Registro huérfano "001_add_order_token" eliminado.';
  END IF;
END $$;

-- 4. Marcar como aplicadas todas las migraciones que ya están reflejadas en el esquema.
--    Esto evita que el migrador intenta ejecutarlas nuevamente.
INSERT INTO migrations (name) VALUES
  ('002_add_multi_tenancy.sql'),
  ('003_add_missing_columns.sql'),
  ('003_enable_rls.sql'),
  ('004_add_orders_missing_columns.sql'),
  ('005_add_coupons.sql'),
  ('006_add_order_coupon_fields.sql'),
  ('007_shipping_rates.sql'),
  ('008_add_users_last_login.sql'),
  ('009_carousel_images.sql'),
  ('009_section_content.sql'),
  ('010_add_carousel_fields.sql'),
  ('011_fix_utf8_encoding.sql'),
  ('012_fix_remaining_encoding.sql'),
  ('012_inventory_tables.sql'),
  ('013_add_testimonials_product_image.sql'),
  ('014_add_site_texts_tenant_id.sql')
ON CONFLICT (name) DO NOTHING;

-- 5. Verificación: mostrar el estado actual de las migraciones
SELECT name, applied_at FROM migrations ORDER BY name;
