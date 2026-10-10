-- Fase 2 admin: borrado lógico de pedidos y ventas (archivar en vez de eliminar).
-- Idempotente: seguro re-ejecutar. Solo corre en Postgres vía migrator.js;
-- en SQLite local la columna la asegura initSQLite() con ALTER guarded.
-- ROLLBACK manual (migrator.js no tiene "down" automático):
--   ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS deleted_at;
--   ALTER TABLE IF EXISTS sales DROP COLUMN IF EXISTS deleted_at;
--   DROP INDEX IF EXISTS idx_orders_deleted_at;
--   DROP INDEX IF EXISTS idx_sales_deleted_at;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sales_deleted_at ON sales(deleted_at);
