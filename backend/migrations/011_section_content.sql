-- Tabla section_content: textos editables por sección
CREATE TABLE IF NOT EXISTS section_content (
  section_key TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_section_content_tenant ON section_content(tenant_id);
