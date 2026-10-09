-- Migración 022: Columnas que estaban en db.js ALTER TABLE pero no en migraciones
-- Ejecutada solo si faltan (idempotente via information_schema)

-- products
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_token TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- product_images
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS filename TEXT DEFAULT '';
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- activity_log
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS related_order_id INTEGER DEFAULT 0;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- hero_cards
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT '';
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS subtitulo TEXT DEFAULT '';
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS cta_texto TEXT DEFAULT '';
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS cta_url TEXT DEFAULT '';
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS slot INTEGER DEFAULT 0;
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'hero';

-- testimonials
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS product_image_url TEXT DEFAULT '';

-- site_texts
ALTER TABLE site_texts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- section_content
ALTER TABLE section_content ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- coupons
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- carousel_images
ALTER TABLE carousel_images ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT '';
ALTER TABLE carousel_images ADD COLUMN IF NOT EXISTS about_group INTEGER DEFAULT 0;
ALTER TABLE carousel_images ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- payment_config
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS transfer_alias TEXT DEFAULT '';
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS cbu_cvu TEXT DEFAULT '';
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS cash_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS notify_client_rejected BOOLEAN DEFAULT TRUE;
ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS included_shipping_cost NUMERIC(10,2) DEFAULT 0;

-- contacts, reviews, subscribers, webhook_events, payment_proofs, site_settings
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE payment_proofs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';