CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'percent',
  value REAL NOT NULL,
  min_amount REAL DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idempotente: agregar tenant_id si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coupons' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE coupons ADD COLUMN tenant_id TEXT DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coupons_tenant_id ON coupons(tenant_id);
