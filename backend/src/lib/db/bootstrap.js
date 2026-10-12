const logger = require('../logger');
const { query } = require('./query');
const { getIsLocal } = require('./pool');
const { runMigrationsOnly, runSQLiteMigrations } = require('./migrations');
const { ensureAdminUser } = require('./seeds');

async function initSQLite() {
    await query(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS site_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT 'default'
    )`);
    await query(`CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS section_content (
      section_key TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      subtitle TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT 'default'
    )`);
    await query("INSERT OR IGNORE INTO section_content (section_key, title, subtitle, tenant_id) VALUES ('testimonials', 'Lo que dicen nuestros clientes', 'Historias reales de personas que confiaron en nosotros', 'default')");
    await query(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      customer TEXT,
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
      payment_method TEXT DEFAULT 'transfer',
      coupon_code TEXT DEFAULT '',
      coupon_discount REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      deleted_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      name TEXT DEFAULT '',
      price REAL DEFAULT 0,
      quantity INTEGER DEFAULT 1,
      emoji TEXT DEFAULT '',
      image TEXT DEFAULT '',
      category_name TEXT DEFAULT '',
      category_slug TEXT DEFAULT '',
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      sale_date DATE DEFAULT CURRENT_DATE,
      deleted_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date)');
    await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT DEFAULT 'adjustment',
      quantity INTEGER DEFAULT 0,
      previous_stock INTEGER DEFAULT 0,
      new_stock INTEGER DEFAULT 0,
      reason TEXT DEFAULT '',
      reference_id TEXT DEFAULT '',
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at)');
    await query(`CREATE TABLE IF NOT EXISTS inventory_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT DEFAULT 'low_stock',
      message TEXT DEFAULT '',
      resolved BOOLEAN DEFAULT FALSE,
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product ON inventory_alerts(product_id)');
    await query(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      name TEXT DEFAULT '',
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
     try {
       await query('ALTER TABLE reviews ADD COLUMN name TEXT DEFAULT \'\'');
     } catch (err) {
       if (!err.message.includes('duplicate column name')) {
         throw err;
       }
     }
     try {
       await query('ALTER TABLE reviews ADD COLUMN avatar TEXT DEFAULT \'\'');
     } catch (err) {
       if (!err.message.includes('duplicate column name')) {
         throw err;
       }
     }
    await query(`CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS payment_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mp_alias TEXT DEFAULT '',
      transfer_alias TEXT DEFAULT '',
      holder_name TEXT DEFAULT '',
      cbu_cvu TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      message TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      mp_enabled BOOLEAN DEFAULT FALSE,
      cash_enabled BOOLEAN DEFAULT FALSE,
      shipping_cost REAL DEFAULT 0,
      free_shipping_from REAL DEFAULT 0,
      included_shipping_cost REAL DEFAULT 0,
      notify_admin_new_proof BOOLEAN DEFAULT TRUE,
      notify_client_approved BOOLEAN DEFAULT TRUE,
      notify_client_rejected BOOLEAN DEFAULT TRUE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS payment_proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      customer_name TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      proof_url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT DEFAULT '',
      reviewed_at DATETIME,
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_payment_proofs_created_at ON payment_proofs(created_at)');
    await query(`CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT 'default'
    )`);
    await query(`CREATE TABLE IF NOT EXISTS hero_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS carousel_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
      url TEXT NOT NULL,
      public_id TEXT DEFAULT '',
      alt_text TEXT DEFAULT '',
      link_url TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      about_group INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id TEXT DEFAULT 'default'
    )`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_carousel_images_slot ON carousel_images(slot, tenant_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_carousel_images_slot_order ON carousel_images(slot)');
    await query(`CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE NOT NULL,
      source TEXT DEFAULT 'transfer',
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      processed_at DATETIME,
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT DEFAULT 'admin',
      action TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id INTEGER DEFAULT 0,
      details TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      related_order_id INTEGER DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      zip TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      blocked BOOLEAN DEFAULT FALSE,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT DEFAULT '',
      role TEXT DEFAULT 'admin',
      permissions TEXT DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS product_bulk_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      total_rows INTEGER DEFAULT 0,
      success_rows INTEGER DEFAULT 0,
      error_rows INTEGER DEFAULT 0,
      errors TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      filename TEXT DEFAULT '',
      url TEXT DEFAULT '',
      sent_whatsapp BOOLEAN DEFAULT FALSE,
      sent_email BOOLEAN DEFAULT FALSE,
      tenant_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    logger.info('Tablas de base de datos inicializadas (SQLite)');
    try {
      await query('ALTER TABLE users ADD COLUMN last_login DATETIME');
    } catch (err) {
      logger.debug({ err: err.message }, 'Columna last_login ya existe o no se pudo agregar (SQLite)');
    }
   try {
      await ensureAdminUser();
    } catch (err) {
      logger.warn({ err: err.message }, 'No se pudo asegurar usuario admin (SQLite)');
    }
     try {
       await query('ALTER TABLE product_images ADD COLUMN cloudinary_public_id TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna cloudinary_public_id ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE product_images ADD COLUMN alt TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna alt ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_name TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_name ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_address TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_address ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_phone TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_phone ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_zip TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_zip ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_city TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_city ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_email TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_email ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN order_token TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna order_token ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna subtotal ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN shipping_cost REAL DEFAULT 0');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna shipping_cost ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE product_images ADD COLUMN descripcion TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna descripcion ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE product_images ADD COLUMN categoria TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna categoria ya existe o no se pudo agregar (SQLite)');
     }
       try {
         await query('ALTER TABLE product_images ADD COLUMN filename TEXT DEFAULT \'\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna filename ya existe o no se pudo agregar (SQLite)');
       }
       try {
         await query('ALTER TABLE products ADD COLUMN deleted BOOLEAN DEFAULT FALSE');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna deleted ya existe o no se pudo agregar (SQLite)');
       }
       try {
         await query('ALTER TABLE categories ADD COLUMN image TEXT DEFAULT \'\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna image en categories ya existe o no se pudo agregar (SQLite)');
       }
       try {
         await query('ALTER TABLE products ADD COLUMN slug TEXT DEFAULT \'\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna slug ya existe o no se pudo agregar (SQLite)');
       }
     await query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');

     const sqliteRenameMigrations = [
       { name: 'rename_sort_order_to_orden', oldCol: 'sort_order', sql: 'ALTER TABLE product_images RENAME COLUMN sort_order TO orden' },
       { name: 'rename_is_primary_to_es_principal', oldCol: 'is_primary', sql: 'ALTER TABLE product_images RENAME COLUMN is_primary TO es_principal' }
     ];

     for (const mig of sqliteRenameMigrations) {
       const applied = await query('SELECT COUNT(*) AS count FROM migrations WHERE name = ?', [mig.name]);
       if (applied.rows[0].count > 0) continue;
       const pragmaResult = await query('PRAGMA table_info(product_images)');
       const colExists = pragmaResult.rows.some(row => row.name === mig.oldCol);
       if (colExists) {
         await query(mig.sql);
       }
       await query('INSERT OR IGNORE INTO migrations (name) VALUES (?)', [mig.name]);
     }
     try {
       await query('ALTER TABLE products ADD COLUMN featured BOOLEAN DEFAULT FALSE');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna featured ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna active ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT \'\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna notes ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE orders ADD COLUMN deleted_at DATETIME NULL');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna deleted_at ya existe o no se pudo agregar en orders (SQLite)');
     }
     try {
       await query('ALTER TABLE sales ADD COLUMN deleted_at DATETIME NULL');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna deleted_at ya existe o no se pudo agregar en sales (SQLite)');
     }
     try {
       await query('ALTER TABLE activity_log ADD COLUMN related_order_id INTEGER DEFAULT 0');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna related_order_id ya existe o no se pudo agregar (SQLite)');
     }
     try {
       await query('ALTER TABLE activity_log ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar (SQLite)');
     }
       try {
          await query('ALTER TABLE categories ADD COLUMN orden INTEGER DEFAULT 0');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna orden ya existe o no se pudo agregar (SQLite)');
       }
       try {
          await query('ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT NULL');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna parent_id ya existe o no se pudo agregar (SQLite)');
       }
       try {
          await query('ALTER TABLE categories ADD COLUMN image_url TEXT DEFAULT \'\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna image_url ya existe o no se pudo agregar (SQLite)');
       }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN titulo TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna titulo ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN subtitulo TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna subtitulo ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN cta_texto TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna cta_texto ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN descripcion TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna descripcion ya existe o no se pudo agregar en hero_cards (SQLite)');
      }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN cta_url TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna cta_url ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN slot INTEGER DEFAULT 0');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna slot ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE hero_cards ADD COLUMN tipo TEXT DEFAULT \'hero\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna tipo ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_cards_slot ON hero_cards(slot) WHERE slot > 0');
      } catch (err) {
        logger.debug({ err: err.message }, 'Índice unique slot ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('CREATE INDEX IF NOT EXISTS idx_orders_order_token ON orders(order_token)');
      } catch (err) {
        logger.debug({ err: err.message }, 'Índice order_token ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = 1');
      } catch (err) {
        logger.debug({ err: err.message }, 'Índice featured ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status)');
      } catch (err) {
        logger.debug({ err: err.message }, 'Índice webhook status ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC)');
      } catch (err) {
        logger.debug({ err: err.message }, 'Índice activity_log created_at ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('CREATE INDEX IF NOT EXISTS idx_activity_log_related_order ON activity_log(related_order_id)');
      } catch (err) {
        logger.debug({ err: err.message }, 'Índice activity_log related_order_id ya existe o no se pudo agregar (SQLite)');
      }
        try {
         await query('ALTER TABLE products ADD COLUMN sku TEXT DEFAULT \'\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna sku ya existe o no se pudo agregar (SQLite)');
       }
       try {
         await query('ALTER TABLE testimonials ADD COLUMN product_image_url TEXT DEFAULT \'\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna product_image_url ya existe o no se pudo agregar (SQLite)');
       }
       try {
         await query('ALTER TABLE site_texts ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar en site_texts (SQLite)');
       }
       try {
         await query('ALTER TABLE section_content ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar en section_content (SQLite)');
       }
       try {
         await query('ALTER TABLE users ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar en users (SQLite)');
       }
       try {
         await query('ALTER TABLE receipts ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar en receipts (SQLite)');
       }
       try {
         await query('ALTER TABLE coupons ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar en coupons (SQLite)');
       }
       try {
         await query('ALTER TABLE carousel_images ADD COLUMN tenant_id TEXT DEFAULT \'default\'');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna tenant_id ya existe o no se pudo agregar en carousel_images (SQLite)');
       }
      try {
        await query('ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna payment_method ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE payment_config ADD COLUMN transfer_alias TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna transfer_alias ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE payment_config ADD COLUMN cbu_cvu TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna cbu_cvu ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE payment_config ADD COLUMN mp_enabled BOOLEAN DEFAULT FALSE');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna mp_enabled ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE payment_config ADD COLUMN cash_enabled BOOLEAN DEFAULT FALSE');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna cash_enabled ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE payment_config ADD COLUMN shipping_cost REAL DEFAULT 0');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna shipping_cost ya existe o no se pudo agregar (SQLite)');
      }
       try {
         await query('ALTER TABLE payment_config ADD COLUMN notify_client_rejected BOOLEAN DEFAULT TRUE');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna notify_client_rejected ya existe o no se pudo agregar (SQLite)');
       }
       const tenantIdMigrations = [
         'products',
         'categories',
         'orders',
         'contacts',
         'reviews',
         'testimonials',
         'product_images',
         'subscribers',
         'webhook_events',
         'hero_cards',
         'payment_config',
         'payment_proofs',
         'site_settings',
         'site_texts'
       ];
       for (const table of tenantIdMigrations) {
         try {
           await query(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT DEFAULT 'default'`);
         } catch (err) {
           if (!err.message.includes('duplicate column name')) {
             logger.debug({ err: err.message }, `Columna tenant_id ya existe o no se pudo agregar en ${table} (SQLite)`);
           }
         }
       }
       try {
         await query('ALTER TABLE payment_config ADD COLUMN included_shipping_cost REAL DEFAULT 0');
       } catch (err) {
         logger.debug({ err: err.message }, 'Columna included_shipping_cost ya existe o no se pudo agregar (SQLite)');
       }
       try {
         await query(`CREATE TABLE IF NOT EXISTS shipping_rates_by_province (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           province TEXT UNIQUE NOT NULL,
           shipping_cost REAL DEFAULT 0,
           tenant_id TEXT DEFAULT 'default',
           updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
         )`);
       } catch (err) {
         logger.debug({ err: err.message }, 'Tabla shipping_rates_by_province ya existe o no se pudo crear (SQLite)');
       }
       const defaultProvinces = [
         ['Buenos Aires', 1500], ['Catamarca', 1800], ['Chaco', 1800], ['Chubut', 2200],
         ['Ciudad Autónoma de Buenos Aires', 1500], ['Córdoba', 1700], ['Corrientes', 1800],
         ['Entre Ríos', 1500], ['Formosa', 2000], ['Jujuy', 2200], ['La Pampa', 1800],
         ['La Rioja', 1800], ['Mendoza', 1900], ['Misiones', 1800], ['Neuquén', 2200],
         ['Río Negro', 2200], ['Salta', 2200], ['San Juan', 1900], ['San Luis', 1700],
         ['Santa Cruz', 2500], ['Santa Fe', 1600], ['Santiago del Estero', 1800],
         ['Tierra del Fuego', 2800], ['Tucumán', 1700]
       ];
       for (const [prov, cost] of defaultProvinces) {
         try {
           await query('INSERT OR IGNORE INTO shipping_rates_by_province (province, shipping_cost) VALUES ($1, $2)', [prov, cost]);
         } catch (err) {
           logger.debug({ err: err.message }, `No se pudo insertar provincia ${prov} (SQLite)`);
         }
       }
       try {
         await query("UPDATE payment_config SET included_shipping_cost = 1500 WHERE included_shipping_cost IS NULL OR included_shipping_cost = 0");
       } catch (err) {
         logger.debug({ err: err.message }, 'No se pudo actualizar included_shipping_cost (SQLite)');
       }
       return;
   }


async function ensurePostgresBootstrap() {
  try {
    const pgRenameMigrations = [
      { name: 'rename_sort_order_to_orden', oldCol: 'sort_order', sql: 'ALTER TABLE product_images RENAME COLUMN sort_order TO orden' },
      { name: 'rename_is_primary_to_es_principal', oldCol: 'is_primary', sql: 'ALTER TABLE product_images RENAME COLUMN is_primary TO es_principal' }
    ];

    for (const mig of pgRenameMigrations) {
      try {
        const applied = await query('SELECT COUNT(*) AS count FROM migrations WHERE name = $1', [mig.name]);
        if (applied.rows[0].count > 0) continue;
        const colExists = await query(
          'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_name = \'product_images\' AND column_name = $1',
          [mig.oldCol]
        );
        if (colExists.rows[0].count > 0) {
          await query(mig.sql);
        }
        await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [mig.name]);
      } catch (err) {
        logger.debug({ err: err.message }, `Migración de rename ${mig.name} falló`);
      }
    }
  } catch (err) {
    logger.debug({ err: err.message }, 'Error en migraciones de rename');
  }

  try {
    logger.info('Tablas de base de datos inicializadas (PostgreSQL)');
    const tenantTables = [
      'products', 'categories', 'orders', 'contacts', 'reviews',
      'testimonials', 'product_images', 'subscribers', 'webhook_events',
      'hero_cards', 'payment_config', 'payment_proofs', 'site_settings', 'site_texts', 'section_content'
    ];
    await Promise.all(tenantTables.map(async (table) => {
      try {
        const colExists = await query(
          "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenant_id'",
          [table]
        );
        if (String(colExists.rows[0].count) === '0') {
          await query(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT DEFAULT 'default'`);
        }
      } catch (err) {
        logger.debug({ err: err.message }, `Error asegurando columna tenant_id en ${table}`);
      }
    }));
  } catch (err) {
    logger.debug({ err: err.message }, 'Error asegurando columnas tenant_id (PostgreSQL)');
  }

  try {
    const carouselColumns = ['caption', 'about_group'];
    for (const col of carouselColumns) {
      try {
        const colExists = await query(
          "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_name = 'carousel_images' AND column_name = $1",
          [col]
        );
        if (colExists.rows[0].count === 0) {
          const type = col === 'about_group' ? 'INTEGER DEFAULT 0' : "TEXT DEFAULT ''";
          await query(`ALTER TABLE carousel_images ADD COLUMN ${col} ${type}`);
          logger.info(`Columna ${col} agregada a carousel_images`);
        }
      } catch (err) {
        logger.debug({ err: err.message }, `Error asegurando columna ${col} en carousel_images`);
      }
    }
  } catch (err) {
    logger.debug({ err: err.message }, 'Error asegurando columnas de carousel_images');
  }

     try {
        await query(`CREATE TABLE IF NOT EXISTS shipping_rates_by_province (
          id SERIAL PRIMARY KEY,
          province TEXT UNIQUE NOT NULL,
          shipping_cost NUMERIC(10,2) DEFAULT 0,
          tenant_id TEXT DEFAULT 'default',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      const colExists = await query("SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_name = 'payment_config' AND column_name = 'included_shipping_cost'");
      if (String(colExists.rows[0].count) === '0') {
        await query('ALTER TABLE payment_config ADD COLUMN included_shipping_cost NUMERIC(10,2) DEFAULT 0');
      }
      const provCount = await query('SELECT COUNT(*) AS count FROM shipping_rates_by_province');
      if (String(provCount.rows[0].count) === '0') {
        const defaultProvinces = [
          ['Buenos Aires', 1500], ['Catamarca', 1800], ['Chaco', 1800], ['Chubut', 2200],
          ['Ciudad Autónoma de Buenos Aires', 1500], ['Córdoba', 1700], ['Corrientes', 1800],
          ['Entre Ríos', 1500], ['Formosa', 2000], ['Jujuy', 2200], ['La Pampa', 1800],
          ['La Rioja', 1800], ['Mendoza', 1900], ['Misiones', 1800], ['Neuquén', 2200],
          ['Río Negro', 2200], ['Salta', 2200], ['San Juan', 1900], ['San Luis', 1700],
          ['Santa Cruz', 2500], ['Santa Fe', 1600], ['Santiago del Estero', 1800],
          ['Tierra del Fuego', 2800], ['Tucumán', 1700]
        ];
        await Promise.all(defaultProvinces.map(([prov, cost]) =>
          query('INSERT INTO shipping_rates_by_province (province, shipping_cost) VALUES ($1, $2) ON CONFLICT (province) DO NOTHING', [prov, cost])
        ));
        await query("UPDATE payment_config SET included_shipping_cost = 1500 WHERE included_shipping_cost IS NULL OR included_shipping_cost = 0");
      }
    } catch (err) {
      logger.debug({ err: err.message }, 'Error asegurando shipping_rates_by_province (PostgreSQL)');
    }

    if (process.env.FIX_SEQUENCES === 'true') {
      try {
        const seqTables = ['products', 'categories', 'orders', 'contacts', 'reviews', 'testimonials', 'product_images', 'subscribers', 'webhook_events', 'hero_cards'];
        await Promise.all(seqTables.map((table) =>
          query(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`).catch(() => {})
        ));
      } catch (err) {
        logger.debug({ err: err.message }, 'Error reseteando sequences');
      }
    }

    try {
      await ensureAdminUser();
    } catch (err) {
      logger.warn({ err: err.message }, 'No se pudo asegurar usuario admin (PostgreSQL)');
    }

    try {
      const missingIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_orders_order_token ON orders(order_token)',
        'CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = TRUE',
        'CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status)',
        'CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_activity_log_related_order ON activity_log(related_order_id)'
      ];
      await Promise.all(missingIndexes.map((idxSql) =>
        query(idxSql).catch((err) => logger.debug({ err: err.message }, 'No se pudo crear índice adicional'))
      ));
    } catch (err) {
      logger.debug({ err: err.message }, 'Error creando índices adicionales (PostgreSQL)');
    }

  if (process.env.SEED_DEFAULT_CONTENT === 'true') {
    try {
      await query("INSERT INTO site_texts (key, value, tenant_id) VALUES ('hero_subtitle', 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.', 'default') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP");
    } catch (err) {
      logger.debug({ err: err.message }, 'No se pudo actualizar hero_subtitle');
    }

    try {
      await query("INSERT INTO section_content (section_key, title, subtitle, tenant_id) VALUES ('testimonials', 'Lo que dicen nuestros clientes', 'Historias reales de personas que confiaron en nosotros', 'default') ON CONFLICT (section_key) DO NOTHING");
    } catch (err) {
      logger.debug({ err: err.message }, 'No se pudo seedear section_content');
    }
  }
}

async function setTenant(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') return;
    if (getIsLocal()) return;
    try {
      await query('SELECT set_config($1, $2, false)', ['app.current_tenant', tenantId]);
    } catch (e) {
      // no-op si la BD no soporta set_config
    }
  }

async function initDB() {
  if (getIsLocal()) {
    await initSQLite();
    await runSQLiteMigrations();
  } else {
    await runMigrationsOnly();
    await ensurePostgresBootstrap();
  }
}

module.exports = { initDB, initSQLite, ensurePostgresBootstrap, setTenant };