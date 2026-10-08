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

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product ON inventory_alerts(product_id);