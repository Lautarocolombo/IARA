-- Migración 026: Agregar deleted_at a payment_proofs y receipts para limpieza de huérfanos

-- payment_proofs
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Índices para filtrar no eliminados
CREATE INDEX IF NOT EXISTS idx_payment_proofs_deleted_at ON payment_proofs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_deleted_at ON receipts(deleted_at) WHERE deleted_at IS NULL;