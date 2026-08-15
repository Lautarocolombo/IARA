-- Esquema base actualizado. Para bases de datos existentes, ejecutar las migraciones en orden.
-- Tabla users
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

-- Tabla products
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

-- Tabla categories
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

-- Tabla orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  items JSONB NOT NULL,
  total REAL NOT NULL,
  customer JSONB,
  status TEXT DEFAULT 'pending',
  notes TEXT DEFAULT '',
  shipping_name TEXT DEFAULT '',
  shipping_address TEXT DEFAULT '',
  shipping_phone TEXT DEFAULT '',
  shipping_zip TEXT DEFAULT '',
  shipping_city TEXT DEFAULT '',
  shipping_email TEXT DEFAULT '',
  subtotal REAL DEFAULT 0,
  shipping_cost REAL DEFAULT 0,
  payment_method TEXT DEFAULT '',
  order_token TEXT DEFAULT '',
  coupon_code TEXT DEFAULT '',
  coupon_discount REAL DEFAULT 0,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla order_items (reservada para uso futuro, actualmente orders usa JSONB)
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  emoji TEXT DEFAULT '📿',
  image TEXT DEFAULT ''
);

-- Tabla customers
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
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla contacts
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla testimonials
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

-- Tabla reviews
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla sales
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

-- Tabla subscribers
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla payment_config
CREATE TABLE IF NOT EXISTS payment_config (
  id SERIAL PRIMARY KEY,
  mp_alias TEXT DEFAULT '',
  transfer_alias TEXT DEFAULT '',
  cbu_cvu TEXT DEFAULT '',
  holder_name TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  message TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  mp_enabled BOOLEAN DEFAULT FALSE,
  cash_enabled BOOLEAN DEFAULT FALSE,
  shipping_cost REAL DEFAULT 0,
  free_shipping_from REAL DEFAULT 0,
  included_shipping_cost NUMERIC(10,2) DEFAULT 0,
  notify_admin_new_proof BOOLEAN DEFAULT TRUE,
  notify_client_approved BOOLEAN DEFAULT TRUE,
  notify_client_rejected BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla payment_proofs
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

-- Tabla site_texts
CREATE TABLE IF NOT EXISTS site_texts (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla site_settings
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla hero_cards
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
  cta_texto TEXT DEFAULT '',
  cta_url TEXT DEFAULT '',
  slot INTEGER DEFAULT 0,
  tipo TEXT DEFAULT 'hero',
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla product_images
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

-- Tabla webhook_events
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

-- Tabla activity_log
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

-- Tabla product_bulk_imports
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

-- Tabla receipts
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  filename TEXT DEFAULT '',
  url TEXT DEFAULT '',
  sent_whatsapp BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla coupons
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'percent',
  value REAL NOT NULL,
  min_amount REAL DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla shipping_rates_by_province
CREATE TABLE IF NOT EXISTS shipping_rates_by_province (
  id SERIAL PRIMARY KEY,
  province TEXT UNIQUE NOT NULL,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla user_tenants
CREATE TABLE IF NOT EXISTS user_tenants (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_email ON orders(shipping_email);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_hero_cards_slot ON hero_cards(slot) WHERE slot > 0;
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_tenant_id ON coupons(tenant_id);
