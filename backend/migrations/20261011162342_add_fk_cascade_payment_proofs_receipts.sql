-- =============================================================================
-- 20261011162342_add_fk_cascade_payment_proofs_receipts — FK CASCADE orders
-- =============================================================================
-- Agrega FOREIGN KEY con ON DELETE CASCADE a payment_proofs.order_id y
-- receipts.order_id referenciando orders(id).
--
-- PROBLEMA: Al borrar un pedido (orders), los comprobantes (payment_proofs)
-- y recibos (receipts) quedaban huérfanos. Con CASCADE se eliminan en cascada.
--
-- VERIFICACIÓN PREVIA (ejecutar en staging/Neon branch):
--   SELECT conname, contype, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid IN ('payment_proofs'::regclass, 'receipts'::regclass)
--     AND contype = 'f';
--   Debe devolver 0 filas (no FK existentes).
--
-- ROLLBACK MANUAL (si falla):
--   ALTER TABLE payment_proofs DROP CONSTRAINT IF EXISTS payment_proofs_order_id_fkey;
--   ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_order_id_fkey;
-- =============================================================================

-- ---------- payment_proofs.order_id -> orders(id) ON DELETE CASCADE ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_proofs_order_id_fkey'
  ) THEN
    ALTER TABLE payment_proofs
    ADD CONSTRAINT payment_proofs_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'FK payment_proofs_order_id_fkey creada con ON DELETE CASCADE';
  ELSE
    RAISE NOTICE 'FK payment_proofs_order_id_fkey ya existe, se omite';
  END IF;
END $$;

-- ---------- receipts.order_id -> orders(id) ON DELETE CASCADE ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_order_id_fkey'
  ) THEN
    ALTER TABLE receipts
    ADD CONSTRAINT receipts_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'FK receipts_order_id_fkey creada con ON DELETE CASCADE';
  ELSE
    RAISE NOTICE 'FK receipts_order_id_fkey ya existe, se omite';
  END IF;
END $$;

-- ---------- Verificación post-migración ----------
-- Debe devolver 2 filas:
--   payment_proofs_order_id_fkey | f | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
--   receipts_order_id_fkey       | f | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname IN ('payment_proofs_order_id_fkey', 'receipts_order_id_fkey');