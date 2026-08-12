-- Migracion para Artesania Gualeguay - Render
-- Ejecutar en la base de datos PostgreSQL de Render (seccion "Shell" o "psql")

-- Tabla sales (ventas manuales)
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Columnas nuevas en orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer JSONB DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost REAL DEFAULT 0;

-- Tablas auxiliares que pueden faltar
CREATE TABLE IF NOT EXISTS payment_proofs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  customer_name TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  proof_url TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT DEFAULT '',
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT DEFAULT '',
  filename TEXT DEFAULT '',
  cloudinary_public_id TEXT DEFAULT '',
  orden INTEGER DEFAULT 0,
  es_principal BOOLEAN DEFAULT FALSE,
  descripcion TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  emoji TEXT DEFAULT '',
  image TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  username TEXT DEFAULT 'admin',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id INTEGER DEFAULT 0,
  details TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  related_order_id INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  blocked BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT '',
  role TEXT DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_bulk_imports (
  id SERIAL PRIMARY KEY,
  filename TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  errors TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  filename TEXT DEFAULT '',
  url TEXT DEFAULT '',
  sent_whatsapp BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hero_cards (
  id SERIAL PRIMARY KEY,
  nombre TEXT DEFAULT '',
  precio TEXT DEFAULT '',
  imagen TEXT DEFAULT '',
  emoji TEXT DEFAULT '📿',
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  titulo TEXT DEFAULT '',
  subtitulo TEXT DEFAULT '',
  descripcion TEXT DEFAULT '',
  cta_texto TEXT DEFAULT '',
  cta_url TEXT DEFAULT '',
  slot INTEGER DEFAULT 0,
  tipo TEXT DEFAULT 'hero',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'transfer',
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
