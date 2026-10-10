-- Migración 024: Soft delete para pedidos
-- Agrega columna deleted_at a orders y actualiza índices

-- Agregar columna deleted_at a orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Índice para filtrar pedidos no eliminados
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NULL;

-- Índice compuesto para listados admin (status + deleted_at + fecha)
CREATE INDEX IF NOT EXISTS idx_orders_status_deleted_created ON orders(status, deleted_at, created_at DESC) WHERE deleted_at IS NULL;

-- Actualizar vistas/queries existentes para filtrar deleted_at IS NULL
-- Nota: Las queries en controladores deben agregar WHERE deleted_at IS NULL