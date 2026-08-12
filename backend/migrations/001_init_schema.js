'use strict';

module.exports = {
  name: '001_init_schema',
  async up(sql) {
    sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT DEFAULT '',
        role TEXT DEFAULT 'admin',
        permissions JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        emoji TEXT DEFAULT '📿',
        image TEXT DEFAULT ''
      )
    `;
    sql`
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
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT DEFAULT '',
        name TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        sale_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
        notify_admin_new_proof BOOLEAN DEFAULT TRUE,
        notify_client_approved BOOLEAN DEFAULT TRUE,
        notify_client_rejected BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS site_texts (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_id TEXT UNIQUE NOT NULL,
        source TEXT DEFAULT 'transfer',
        payload JSONB NOT NULL,
        status TEXT DEFAULT 'pending',
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
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
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS product_bulk_imports (
        id SERIAL PRIMARY KEY,
        filename TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        total_rows INTEGER DEFAULT 0,
        success_rows INTEGER DEFAULT 0,
        error_rows INTEGER DEFAULT 0,
        errors TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        filename TEXT DEFAULT '',
        url TEXT DEFAULT '',
        sent_whatsapp BOOLEAN DEFAULT FALSE,
        sent_email BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`
      CREATE TABLE IF NOT EXISTS user_tenants (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`;
    sql`CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)`;
    sql`CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted)`;
    sql`CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)`;
    sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`;
    sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
    sql`CREATE INDEX IF NOT EXISTS idx_orders_shipping_email ON orders(shipping_email)`;
    sql`CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date)`;
    sql`CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id)`;
    sql`CREATE INDEX IF NOT EXISTS idx_hero_cards_slot ON hero_cards(slot) WHERE slot > 0`;
  },

  async down(sql) {
    sql`DROP TABLE IF EXISTS user_tenants CASCADE`;
    sql`DROP TABLE IF EXISTS receipts CASCADE`;
    sql`DROP TABLE IF EXISTS product_bulk_imports CASCADE`;
    sql`DROP TABLE IF EXISTS activity_log CASCADE`;
    sql`DROP TABLE IF EXISTS webhook_events CASCADE`;
    sql`DROP TABLE IF EXISTS product_images CASCADE`;
    sql`DROP TABLE IF EXISTS hero_cards CASCADE`;
    sql`DROP TABLE IF EXISTS site_settings CASCADE`;
    sql`DROP TABLE IF EXISTS site_texts CASCADE`;
    sql`DROP TABLE IF EXISTS payment_proofs CASCADE`;
    sql`DROP TABLE IF EXISTS payment_config CASCADE`;
    sql`DROP TABLE IF EXISTS subscribers CASCADE`;
    sql`DROP TABLE IF EXISTS sales CASCADE`;
    sql`DROP TABLE IF EXISTS reviews CASCADE`;
    sql`DROP TABLE IF EXISTS testimonials CASCADE`;
    sql`DROP TABLE IF EXISTS contacts CASCADE`;
    sql`DROP TABLE IF EXISTS customers CASCADE`;
    sql`DROP TABLE IF EXISTS orders CASCADE`;
    sql`DROP TABLE IF EXISTS categories CASCADE`;
    sql`DROP TABLE IF EXISTS products CASCADE`;
    sql`DROP TABLE IF EXISTS users CASCADE`;
  },
};
