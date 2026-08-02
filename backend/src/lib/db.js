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
  return new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
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
      category TEXT DEFAULT 'pulseras',
      price REAL NOT NULL,
      description TEXT DEFAULT '',
      emoji TEXT DEFAULT '📿',
      image TEXT DEFAULT '',
      badge TEXT DEFAULT '',
      stock INTEGER DEFAULT 0,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      customer TEXT,
      status TEXT DEFAULT 'pending',
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
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
      transfer_alias TEXT DEFAULT '',
      holder_name TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      message TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      url TEXT NOT NULL,
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
    logger.info('Tablas de base de datos inicializadas (SQLite)');
    try {
      await query('ALTER TABLE product_images ADD COLUMN cloudinary_public_id TEXT DEFAULT \'\'');
    } catch (err) {
      logger.debug({ err: err.message }, 'Columna cloudinary_public_id ya existe o no se pudo agregar (SQLite)');
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
    return;
  }

  const statements = [
    'CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT DEFAULT \'pulseras\', price REAL NOT NULL, description TEXT DEFAULT \'\', emoji TEXT DEFAULT \'📿\', image TEXT DEFAULT \'\', badge TEXT DEFAULT \'\', stock INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS site_texts (id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT DEFAULT \'\', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS testimonials (id SERIAL PRIMARY KEY, name TEXT NOT NULL, comment TEXT NOT NULL, rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5), image TEXT DEFAULT \'\', avatar TEXT DEFAULT \'\', role TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, featured BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, items JSONB NOT NULL, total REAL NOT NULL, customer JSONB, status TEXT DEFAULT \'pending\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS subscribers (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), comment TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT \'new\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS payment_config (id SERIAL PRIMARY KEY, transfer_alias TEXT DEFAULT \'\', holder_name TEXT DEFAULT \'\', whatsapp TEXT DEFAULT \'\', message TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS site_settings (id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT DEFAULT \'\', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS product_images (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, url TEXT NOT NULL, filename TEXT DEFAULT \'\', cloudinary_public_id TEXT DEFAULT \'\', orden INTEGER DEFAULT 0, es_principal BOOLEAN DEFAULT FALSE, descripcion TEXT DEFAULT \'\', categoria TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS webhook_events (id SERIAL PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, source TEXT DEFAULT \'transfer\', payload JSONB NOT NULL, status TEXT DEFAULT \'pending\', processed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
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

  const alterStatements = [
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT DEFAULT \'\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal REAL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost REAL DEFAULT 0',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT \'\'',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT \'\'',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
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

  logger.info('Tablas de base de datos inicializadas (PostgreSQL)');
}

module.exports = { query, initDB, pool, connectionString: !!connectionString, getClient, transaction };
