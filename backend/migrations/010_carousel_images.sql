CREATE TABLE IF NOT EXISTS carousel_images (
  id SERIAL PRIMARY KEY,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  url TEXT NOT NULL,
  public_id TEXT,
  alt_text TEXT,
  link_url TEXT,
  caption TEXT DEFAULT '',
  about_group INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  UNIQUE(slot, tenant_id)
);

-- Idempotente: agregar tenant_id si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'carousel_images' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE carousel_images ADD COLUMN tenant_id TEXT DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_carousel_images_slot ON carousel_images(slot);
