-- Tabla section_content: textos editables por sección
CREATE TABLE IF NOT EXISTS section_content (
  section_key TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default'
);

-- Idempotente: agregar tenant_id si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'section_content' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE section_content ADD COLUMN tenant_id TEXT DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_section_content_tenant ON section_content(tenant_id);
