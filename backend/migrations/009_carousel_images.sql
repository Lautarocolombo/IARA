CREATE TABLE IF NOT EXISTS carousel_images (
  id SERIAL PRIMARY KEY,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  url TEXT NOT NULL,
  public_id TEXT,
  alt_text TEXT,
  link_url TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  UNIQUE(slot, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_carousel_images_slot ON carousel_images(slot);
