-- Agrega columna receipt_url a orders para guardar la URL del comprobante subido por el cliente
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS receipt_url TEXT;
