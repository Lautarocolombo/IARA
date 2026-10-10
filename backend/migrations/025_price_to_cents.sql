-- Migración 025: Migrar precios de REAL a centavos (INTEGER)
-- Convierte la columna price de REAL a INTEGER (centavos) para evitar problemas de precisión
-- Agrega price_cents, migra datos, elimina price, renombra price_cents a price

BEGIN;

-- 1. Agregar nueva columna price_cents
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0;

-- 2. Migrar datos: price (REAL) -> price_cents (INTEGER)
-- Redondear al centavo más cercano para evitar pérdida de precisión
UPDATE products 
SET price_cents = ROUND(price * 100) 
WHERE price IS NOT NULL;

-- 3. Verificar migración
-- SELECT id, name, price, price_cents, ROUND(price * 100) as expected 
-- FROM products WHERE price IS NOT NULL ORDER BY id;

-- 4. Eliminar columna price original
ALTER TABLE products DROP COLUMN IF EXISTS price;

-- 5. Renombrar price_cents a price
ALTER TABLE products RENAME COLUMN price_cents TO price;

-- 6. Agregar constraint para asegurar que price sea >= 0
ALTER TABLE products ADD CONSTRAINT products_price_nonnegative CHECK (price >= 0);

-- 7. Actualizar también sales si existe columna total/price
-- sales usa total REAL, mantener como está por ahora (es append-only)

COMMIT;

-- DOWN (para rollback si es necesario):
-- BEGIN;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS price_old REAL;
-- UPDATE products SET price_old = price / 100.0;
-- ALTER TABLE products DROP COLUMN IF EXISTS price;
-- ALTER TABLE products RENAME COLUMN price_old TO price;
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_nonnegative;
-- COMMIT;