CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  type TEXT DEFAULT 'adjustment',
  quantity INTEGER DEFAULT 0,
  previous_stock INTEGER DEFAULT 0,
  new_stock INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  reference_id TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idempotente: agregar tenant_id si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_movements' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE inventory_movements ADD COLUMN tenant_id TEXT DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  type TEXT DEFAULT 'low_stock',
  message TEXT DEFAULT '',
  resolved BOOLEAN DEFAULT FALSE,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Idempotente: agregar tenant_id si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_alerts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE inventory_alerts ADD COLUMN tenant_id TEXT DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product ON inventory_alerts(product_id);