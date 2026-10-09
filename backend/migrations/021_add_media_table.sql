-- Tabla para almacenar imágenes en la base de datos (Neon/PostgreSQL)
-- Esto permite que las imágenes sobrevivan a deploys y reinicios en Render
CREATE TABLE IF NOT EXISTS media_assets (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT DEFAULT 'admin',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idempotente: agregar tenant_id si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'media_assets' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE media_assets ADD COLUMN tenant_id TEXT DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_id ON media_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

-- Agregar columna media_id a carousel_images para referenciar la imagen en media_assets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carousel_images' AND column_name = 'media_id') THEN
    ALTER TABLE carousel_images ADD COLUMN media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL;
  END IF;
END $$;