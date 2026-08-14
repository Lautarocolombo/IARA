CREATE TABLE IF NOT EXISTS shipping_rates_by_province (
  id SERIAL PRIMARY KEY,
  province TEXT UNIQUE NOT NULL,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS included_shipping_cost NUMERIC(10,2) DEFAULT 0;

INSERT INTO shipping_rates_by_province (province, shipping_cost)
VALUES
  ('Buenos Aires', 1500),
  ('Catamarca', 1800),
  ('Chaco', 1800),
  ('Chubut', 2200),
  ('Ciudad Autónoma de Buenos Aires', 1500),
  ('Córdoba', 1700),
  ('Corrientes', 1800),
  ('Entre Ríos', 1500),
  ('Formosa', 2000),
  ('Jujuy', 2200),
  ('La Pampa', 1800),
  ('La Rioja', 1800),
  ('Mendoza', 1900),
  ('Misiones', 1800),
  ('Neuquén', 2200),
  ('Río Negro', 2200),
  ('Salta', 2200),
  ('San Juan', 1900),
  ('San Luis', 1700),
  ('Santa Cruz', 2500),
  ('Santa Fe', 1600),
  ('Santiago del Estero', 1800),
  ('Tierra del Fuego', 2800),
  ('Tucumán', 1700)
ON CONFLICT (province) DO NOTHING;

UPDATE payment_config SET included_shipping_cost = 1500 WHERE included_shipping_cost IS NULL OR included_shipping_cost = 0;
