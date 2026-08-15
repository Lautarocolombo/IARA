-- IARA - Migración de emergencia para Neon producción
-- Ejecutar este SQL en el Neon Dashboard → SQL Editor
-- Corrige el error 500 en el catálogo público de productos

-- 1) Asegurar tabla products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT DEFAULT '',
  category TEXT DEFAULT 'pulseras',
  price REAL NOT NULL,
  description TEXT DEFAULT '',
  emoji TEXT DEFAULT '📿',
  image TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  sku TEXT DEFAULT '',
  deleted BOOLEAN DEFAULT FALSE,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2) Asegurar tabla product_images
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
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3) Columnas que pueden faltar en products
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📿';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'pulseras';

-- 4) Columnas que pueden faltar en product_images
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS filename TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT FALSE;

-- 5) Tablas adicionales que necesita el backend
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  customer_name TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  proof_url TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT DEFAULT '',
  reviewed_at TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'transfer',
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6) Columnas que pueden faltar en orders (para /api/admin/earnings)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer JSONB DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_token TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount REAL DEFAULT 0;

-- 7) Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
