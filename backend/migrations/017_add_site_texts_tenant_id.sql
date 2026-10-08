-- Add tenant_id to site_texts table (was missed in 002_add_multi_tenancy)
ALTER TABLE site_texts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- Backfill existing rows
UPDATE site_texts SET tenant_id = 'default' WHERE tenant_id IS NULL;
