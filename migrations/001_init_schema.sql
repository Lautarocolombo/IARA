-- Initial schema for PostgreSQL
-- This migration creates all core tables

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT DEFAULT '',
  category TEXT DEFAULT 'pulseras',
  price NUMERIC(10,2) NOT NULL,
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

-- Site texts table
CREATE TABLE IF NOT EXISTS site_texts (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default'
);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  comment TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  image TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  role TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Section content table
CREATE TABLE IF NOT EXISTS section_content (
  section_key TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default'
);

INSERT INTO section_content (section_key, title, subtitle, tenant_id) 
VALUES ('testimonials', 'Lo que dicen nuestros clientes', 'Historias reales de personas que confiaron en nosotros', 'default')
ON CONFLICT (section_key) DO NOTHING;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  items JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  customer JSONB,
  status TEXT DEFAULT 'pending',
  notes TEXT DEFAULT '',
  shipping_name TEXT DEFAULT '',
  shipping_address TEXT DEFAULT '',
  shipping_phone TEXT DEFAULT '',
  shipping_zip TEXT DEFAULT '',
  shipping_city TEXT DEFAULT '',
  shipping_email TEXT DEFAULT '',
  subtotal NUMERIC(10,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'transfer',
  coupon_code TEXT DEFAULT '',
  coupon_discount NUMERIC(10,2) DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  deleted_at TIMESTAMP NULL,
  order_token TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT DEFAULT '',
  price NUMERIC(10,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  emoji TEXT DEFAULT '',
  image TEXT DEFAULT '',
  category_name TEXT DEFAULT '',
  category_slug TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);

-- Inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  type TEXT DEFAULT 'adjustment',
  quantity INTEGER DEFAULT 0,
  previous_stock INTEGER DEFAULT 0,
  new_stock INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  reference_id TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);

-- Inventory alerts table
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  type TEXT DEFAULT 'low_stock',
  message TEXT DEFAULT '',
  resolved BOOLEAN DEFAULT FALSE,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product ON inventory_alerts(product_id);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment config table
CREATE TABLE IF NOT EXISTS payment_config (
  id SERIAL PRIMARY KEY,
  mp_alias TEXT DEFAULT '',
  transfer_alias TEXT DEFAULT '',
  holder_name TEXT DEFAULT '',
  cbu_cvu TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  message TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  mp_enabled BOOLEAN DEFAULT FALSE,
  cash_enabled BOOLEAN DEFAULT FALSE,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  free_shipping_from NUMERIC(10,2) DEFAULT 0,
  included_shipping_cost NUMERIC(10,2) DEFAULT 0,
  notify_admin_new_proof BOOLEAN DEFAULT TRUE,
  notify_client_approved BOOLEAN DEFAULT TRUE,
  notify_client_rejected BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment proofs table
CREATE TABLE IF NOT EXISTS payment_proofs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  customer_name TEXT DEFAULT '',
  amount NUMERIC(10,2) DEFAULT 0,
  proof_url TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT DEFAULT '',
  reviewed_at TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_created_at ON payment_proofs(created_at);

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default'
);

-- Hero cards table
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
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
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

-- Carousel images table
CREATE TABLE IF NOT EXISTS carousel_images (
  id SERIAL PRIMARY KEY,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  url TEXT NOT NULL,
  public_id TEXT DEFAULT '',
  alt_text TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  about_group INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT DEFAULT 'default'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carousel_images_slot ON carousel_images(slot, tenant_id);
CREATE INDEX IF NOT EXISTS idx_carousel_images_slot_order ON carousel_images(slot);

-- Webhook events table
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

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  emoji TEXT DEFAULT '',
  image TEXT DEFAULT '',
  parent_id INTEGER DEFAULT NULL,
  image_url TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  username TEXT DEFAULT 'admin',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id INTEGER DEFAULT 0,
  details TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  related_order_id INTEGER DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
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

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT '',
  role TEXT DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product bulk imports table
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

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  filename TEXT DEFAULT '',
  url TEXT DEFAULT '',
  sent_whatsapp BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value NUMERIC(10,2) NOT NULL,
  min_amount NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping rates by province table
CREATE TABLE IF NOT EXISTS shipping_rates_by_province (
  id SERIAL PRIMARY KEY,
  province TEXT UNIQUE NOT NULL,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_token ON orders(order_token);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_related_order ON activity_log(related_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_cards_slot ON hero_cards(slot) WHERE slot > 0;