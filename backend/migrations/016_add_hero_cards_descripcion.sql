-- Agrega hero_cards.descripcion, usada por heroCardsController.js (upsert, slot y sync).
-- La columna faltaba en 001_init_schema.sql, lo que hacía fallar con 500 todo guardado de hero cards.

ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';