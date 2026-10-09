-- Agrega la columna last_login a la tabla users para tracking de último acceso
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
