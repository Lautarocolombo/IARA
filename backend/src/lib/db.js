const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  logger.error({ err: err.message }, 'Error cargando sqlite3');
  sqlite3 = null;
}

const connectionString = process.env.DATABASE_URL;
const isLocal = !connectionString;
let db = null;
let pool = null;

function createPool(connectionString) {
  const { Pool } = require('pg');
  let finalConnectionString = connectionString;
  if (process.env.NODE_ENV === 'production' && connectionString && !connectionString.includes('sslmode=')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    finalConnectionString = connectionString + separator + 'sslmode=require';
  }
  return new Pool({
    connectionString: finalConnectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  });
}

async function waitForPool(poolInstance, retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await poolInstance.connect();
      client.release();
      return poolInstance;
    } catch (err) {
      logger.warn({ attempt: i + 1, err: err.message }, 'Pool no listo, reintentando...');
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

if (isLocal) {
  if (!sqlite3) {
    logger.error('sqlite3 no está disponible. Verificá que esté instalado correctamente.');
  } else {
    const dbDir = process.env.VERCEL
      ? '/tmp/ag-data'
      : path.join(__dirname, '..', '..', 'data');
    const dbPath = path.join(dbDir, 'iara.db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new sqlite3.Database(dbPath);
  }
} else {
  (async () => {
    try {
      pool = createPool(connectionString);
      pool.on('error', (err) => {
        logger.error({ err: err.message }, 'Pool error');
      });

      await waitForPool(pool);
      logger.info('Pool de PostgreSQL inicializado correctamente');
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, 'Error inicializando pool de PostgreSQL');
    }
  })();
}

function toSqlite(sql) {
  return sql
    .replace(/\$\d+/g, '?')
    .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/JSONB/g, 'TEXT')
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    .replace(/ON CONFLICT \((.+?)\) DO UPDATE SET/gi, (match, col) => `ON CONFLICT(${col}) DO UPDATE SET`);
}

async function query(text, params, transactionClient = null) {
  const client = transactionClient || pool;
  if (!client && isLocal) {
    return new Promise((resolve, reject) => {
      const sql = toSqlite(text);
      const values = params || [];
      db.all(sql, values, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows, rowCount: rows.length });
      });
    });
  }

  if (!client) {
    throw new Error('No hay conexión a base de datos disponible');
  }

  const start = Date.now();
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      logger.debug({ duration, rows: result.rowCount }, 'Query ejecutada');
      return result;
    } catch (err) {
      const isFinalAttempt = attempt === maxRetries;
      const isRetryable = isRetryableError(err);

      logger.error({ err: err.message, sql: text.substring(0, 200), attempt: attempt + 1, retryable: isRetryable }, 'Error en query');

      if (isFinalAttempt || !isRetryable) {
        throw err;
      }

      const backoff = Math.pow(2, attempt) * 1000;
      logger.warn({ attempt: attempt + 1, backoff }, 'Reintentando query...');
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

function isRetryableError(err) {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'];
  const retryablePgCodes = ['57P03', '57P01', '55P03', '40001', '40P01', '08003', '08006', '08001', '08007'];
  if (!err.code) return true;
  if (retryableCodes.includes(err.code)) return true;
  if (retryablePgCodes.includes(err.code)) return true;
  return false;
}

async function getClient() {
  if (!pool) throw new Error('Pool no inicializado');
  return await pool.connect();
}

async function transaction(fn) {
  if (isLocal) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN', (err) => {
          if (err) return reject(err);
          const run = (sql, params) => {
            return new Promise((res, rej) => {
              const sqlite = toSqlite(sql);
              db.all(sqlite, params, (e, rows) => {
                if (e) return rej(e);
                res({ rows, rowCount: rows ? rows.length : 0 });
              });
            });
          };
          const client = { query: run };
          fn(client)
            .then(result => {
              db.run('COMMIT', err => {
                if (err) return reject(err);
                resolve(result);
              });
            })
            .catch(err => {
              db.run('ROLLBACK', () => reject(err));
            });
        });
      });
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function initDB() {
  if (isLocal) {
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS site_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      name TEXT DEFAULT '',
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      cta_texto TEXT DEFAULT '',
      cta_url TEXT DEFAULT '',
      slot INTEGER DEFAULT 0,
      tipo TEXT DEFAULT 'hero',
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE NOT NULL,
      source TEXT DEFAULT 'transfer',
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      processed_at DATETIME,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    logger.info('Tablas de base de datos inicializadas (SQLite)');
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
       await query('ALTER TABLE categories ADD COLUMN orden INTEGER DEFAULT 0');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna orden ya existe o no se pudo agregar (SQLite)');
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
        await query('ALTER TABLE products ADD COLUMN sku TEXT DEFAULT \'\'');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna sku ya existe o no se pudo agregar (SQLite)');
      }
      try {
        await query('ALTER TABLE testimonials ADD COLUMN orden INTEGER DEFAULT 0');
      } catch (err) {
        logger.debug({ err: err.message }, 'Columna orden ya existe o no se pudo agregar (SQLite)');
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
       await query('ALTER TABLE payment_config ADD COLUMN free_shipping_from REAL DEFAULT 0');
     } catch (err) {
       logger.debug({ err: err.message }, 'Columna free_shipping_from ya existe o no se pudo agregar (SQLite)');
     }
     return;
  }

  const statements = [
      'CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT DEFAULT \'\', category TEXT DEFAULT \'pulseras\', price REAL NOT NULL, description TEXT DEFAULT \'\', emoji TEXT DEFAULT \'📿\', image TEXT DEFAULT \'\', badge TEXT DEFAULT \'\', stock INTEGER DEFAULT 0, featured BOOLEAN DEFAULT FALSE, active BOOLEAN DEFAULT TRUE, sku TEXT DEFAULT \'\', deleted BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS site_texts (id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT DEFAULT \'\', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS testimonials (id SERIAL PRIMARY KEY, name TEXT NOT NULL, comment TEXT NOT NULL, rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5), image TEXT DEFAULT \'\', avatar TEXT DEFAULT \'\', role TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, featured BOOLEAN DEFAULT FALSE, orden INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, items JSONB NOT NULL, total REAL NOT NULL, customer JSONB, status TEXT DEFAULT \'pending\', notes TEXT DEFAULT \'\', shipping_name TEXT DEFAULT \'\', shipping_address TEXT DEFAULT \'\', shipping_phone TEXT DEFAULT \'\', shipping_zip TEXT DEFAULT \'\', shipping_city TEXT DEFAULT \'\', shipping_email TEXT DEFAULT \'\', subtotal REAL DEFAULT 0, shipping_cost REAL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS subscribers (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), comment TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT \'new\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS payment_config (id SERIAL PRIMARY KEY, mp_alias TEXT DEFAULT \'\', transfer_alias TEXT DEFAULT \'\', cbu_cvu TEXT DEFAULT \'\', holder_name TEXT DEFAULT \'\', whatsapp TEXT DEFAULT \'\', message TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, mp_enabled BOOLEAN DEFAULT FALSE, cash_enabled BOOLEAN DEFAULT FALSE, shipping_cost REAL DEFAULT 0, free_shipping_from REAL DEFAULT 0, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS site_settings (id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT DEFAULT \'\', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS hero_cards (id SERIAL PRIMARY KEY, nombre TEXT DEFAULT \'\', precio TEXT DEFAULT \'\', imagen TEXT DEFAULT \'\', emoji TEXT DEFAULT \'📿\', orden INTEGER DEFAULT 0, activo BOOLEAN DEFAULT TRUE, titulo TEXT DEFAULT \'\', subtitulo TEXT DEFAULT \'\', cta_texto TEXT DEFAULT \'\', cta_url TEXT DEFAULT \'\', slot INTEGER DEFAULT 0, tipo TEXT DEFAULT \'hero\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS product_images (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, url TEXT NOT NULL, alt TEXT DEFAULT \'\', filename TEXT DEFAULT \'\', cloudinary_public_id TEXT DEFAULT \'\', orden INTEGER DEFAULT 0, es_principal BOOLEAN DEFAULT FALSE, descripcion TEXT DEFAULT \'\', categoria TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS webhook_events (id SERIAL PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, source TEXT DEFAULT \'transfer\', payload JSONB NOT NULL, status TEXT DEFAULT \'pending\', processed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, orden INTEGER DEFAULT 0, emoji TEXT DEFAULT \'\', image TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, username TEXT DEFAULT \'admin\', action TEXT NOT NULL, entity_type TEXT DEFAULT \'\', entity_id INTEGER DEFAULT 0, details TEXT DEFAULT \'\', ip TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT DEFAULT \'\', address TEXT DEFAULT \'\', city TEXT DEFAULT \'\', zip TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, blocked BOOLEAN DEFAULT FALSE, notes TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT DEFAULT \'\', role TEXT DEFAULT \'admin\', permissions JSONB DEFAULT \'{}\', active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS product_bulk_imports (id SERIAL PRIMARY KEY, filename TEXT DEFAULT \'\', status TEXT DEFAULT \'pending\', total_rows INTEGER DEFAULT 0, success_rows INTEGER DEFAULT 0, error_rows INTEGER DEFAULT 0, errors TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS receipts (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, filename TEXT DEFAULT \'\', url TEXT DEFAULT \'\', sent_whatsapp BOOLEAN DEFAULT FALSE, sent_email BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      logger.error({ err: err.message, sql: sql.substring(0, 200) }, 'Error ejecutando SQL');
    }
  }

  try {
    await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT DEFAULT \'\'');
  } catch (err) {
    logger.debug({ err: err.message }, 'Columna cloudinary_public_id ya existe o no se pudo agregar (PostgreSQL)');
  }

  try {
    await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT \'\'');
  } catch (err) {
    logger.debug({ err: err.message }, 'Columna alt ya existe o no se pudo agregar (PostgreSQL)');
  }

  const alterStatements = [
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost REAL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT \'\'',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT \'\'',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT \'\'',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS filename TEXT DEFAULT \'\'',
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT DEFAULT \'\'',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT \'\'',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE',
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0',
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT \'\'',
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT DEFAULT \'\'',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS subtitulo TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS cta_texto TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS cta_url TEXT DEFAULT \'\'',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS slot INTEGER DEFAULT 0',
    'ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT \'hero\'',
    'ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0',
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS name TEXT DEFAULT \'\'',
    'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT \'\'',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS transfer_alias TEXT DEFAULT \'\'',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS cbu_cvu TEXT DEFAULT \'\'',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN DEFAULT FALSE',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS cash_enabled BOOLEAN DEFAULT FALSE',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS shipping_cost REAL DEFAULT 0',
    'ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS free_shipping_from REAL DEFAULT 0',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_cards_slot ON hero_cards(slot) WHERE slot > 0',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
    'CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id)'
  ];

  for (const sql of alterStatements) {
    try {
      await query(sql);
    } catch (err) {
      logger.debug({ err: err.message }, 'Migración de esquema');
    }
  }

  await query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');

  const pgRenameMigrations = [
    { name: 'rename_sort_order_to_orden', oldCol: 'sort_order', sql: 'ALTER TABLE product_images RENAME COLUMN sort_order TO orden' },
    { name: 'rename_is_primary_to_es_principal', oldCol: 'is_primary', sql: 'ALTER TABLE product_images RENAME COLUMN is_primary TO es_principal' }
  ];

  for (const mig of pgRenameMigrations) {
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
  }

   logger.info('Tablas de base de datos inicializadas (PostgreSQL)');
   try {
     const seqTables = ['products', 'categories', 'orders', 'contacts', 'reviews', 'testimonials', 'product_images', 'subscribers', 'webhook_events', 'hero_cards'];
     for (const table of seqTables) {
       await query(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`).catch(() => {});
     }
   } catch (err) {
     logger.debug({ err: err.message }, 'Error reseteando sequences');
   }
   try {
     await ensureAdminUser();
   } catch (err) {
     logger.warn({ err: err.message }, 'No se pudo asegurar usuario admin (PostgreSQL)');
   }
 }

   async function ensureAdminUser() {
     const ADMIN_USER = process.env.ADMIN_USER;
     const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
     if (!ADMIN_USER || !ADMIN_PASS_HASH) return;
     const existing = await query('SELECT id, password_hash FROM users WHERE username = $1', [ADMIN_USER]);
     if (existing.rows.length === 0) {
       await query('INSERT INTO users (username, password_hash, role, active, permissions) VALUES ($1, $2, $3, $4, $5)', [ADMIN_USER, ADMIN_PASS_HASH, 'admin', true, JSON.stringify({ all: true })]);
     } else if (existing.rows[0].password_hash !== ADMIN_PASS_HASH) {
       await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2', [ADMIN_PASS_HASH, ADMIN_USER]);
     }
   }

 module.exports = { query, initDB, pool, connectionString: !!connectionString, getClient, transaction };
