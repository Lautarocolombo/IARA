let sqlite3 = null;
try { sqlite3 = require('sqlite3').verbose(); } catch (e) { sqlite3 = null; }

const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const isOnVercel = process.env.VERCEL === '1';
const useSqlite = !connectionString;
let db = null;
let pool = null;

if (useSqlite) {
  if (!sqlite3) {
    if (isOnVercel) {
      throw new Error('SQLite no disponible en Vercel. Configura DATABASE_URL para usar PostgreSQL.');
    }
    throw new Error('sqlite3 no está instalado. Ejecutá npm install en backend/.');
  }

  let dbDir;
  let dbPath;

  if (isOnVercel) {
    dbDir = '/tmp';
    dbPath = path.join(dbDir, 'iara.db');
    console.warn('[DB] Entorno Vercel detectado. Usando SQLite en /tmp. Los datos NO persistirán entre invocaciones sin DATABASE_URL.');
  } else {
    dbDir = path.join(__dirname, '..', '..', 'data');
    dbPath = path.join(dbDir, 'iara.db');
  }

  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new sqlite3.Database(dbPath);
    db.run('PRAGMA foreign_keys = ON');
  } catch (err) {
    if (isOnVercel) {
      console.error('[DB] No se pudo inicializar SQLite en /tmp:', err.message);
      throw new Error('No se pudo inicializar base de datos en Vercel. Configura DATABASE_URL para usar PostgreSQL.');
    }
    throw err;
  }
} else {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 20
  });

  pool.on('error', (err) => {
    console.error('Pool error:', err.message);
  });
}

function toSqlite(sql) {
  return sql
    .replace(/\$\d+/g, '?')
    .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/JSONB/g, 'TEXT')
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/ON CONFLICT \((.+?)\) DO UPDATE SET/gi, (match, col) => `ON CONFLICT(${col}) DO UPDATE SET`);
}

function runSqlite(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function pragmaTableInfo(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function columnExists(columns, col) {
  return columns.some(c => c.name === col);
}

function addColumnIfMissing(table, column, definition) {
  return pragmaTableInfo(table).then(columns => {
    if (!columnExists(columns, column)) {
      return runSqlite(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }).catch(() => {});
}

async function query(text, params) {
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      const sql = toSqlite(text);
      const values = params || [];
      db.all(sql, values, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows, rowCount: rows.length });
      });
    });
  }

  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.debug('Query executed', { text, duration, rows: result.rowCount });
  return result;
}

const productSeeds = [
  { id: 1, name: 'Pulsera Minimalista Rosa', category: 'pulseras', price: 450, description: 'Diseño minimalista con cuentas de cerámica en tonos rosa pastel', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 2, name: 'Pulsera Menta Orgánica', category: 'pulseras', price: 520, description: 'Pulsera tejida con materiales ecológicos en tonos verdes', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 3, name: 'Llavero Artesanal', category: 'accesorios', price: 250, description: 'Llavero tejido a mano con detalle floral', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 4, name: 'Souvenir Gualeguay', category: 'souvenirs', price: 380, description: 'Imán decorativo con representación local', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 5, name: 'Pulsera Bohemia Multi', category: 'pulseras', price: 590, description: 'Pulsera con múltiples hilos y cuentas en tonos variados', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 6, name: 'Collar Artesanal Corto', category: 'accesorios', price: 650, description: 'Collar corto con colgante hecho a mano', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 7, name: 'Pack 3 Pulseras Surtidas', category: 'pulseras', price: 1200, description: 'Set de 3 pulseras con diferentes diseños', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 8, name: 'Brazalete Tejido Premium', category: 'pulseras', price: 890, description: 'Brazalete ancho tejido con técnica tradicional', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 9, name: 'Souvenir Taza Personalizada', category: 'souvenirs', price: 320, description: 'Taza de cerámica con diseño exclusivo de Gualeguay', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 10, name: 'Anillo Cerámica', category: 'accesorios', price: 280, description: 'Anillo ajustable hecho de cerámica cocida artesanalmente', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 11, name: 'Pulsera Amistad Dual', category: 'pulseras', price: 480, description: 'Pulsera de amistad para compartir en tonos complementarios', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 12, name: 'Marcapáginas Decorativo', category: 'souvenirs', price: 150, description: 'Marcapáginas hecho a mano con técnica mixta', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 13, name: 'Pulsera Perlas Naturales', category: 'pulseras', price: 620, description: 'Pulsera con perlas naturales y cierre ajustable', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 14, name: 'Dije Macramé', category: 'accesorios', price: 350, description: 'Dije tejido en macramé con hilo encerado', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 15, name: 'Imán Cerámica Flor', category: 'souvenirs', price: 180, description: 'Imán de cerámica con detalle flor pintado a mano', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 16, name: 'Pulsera Trenzada Cuero', category: 'pulseras', price: 750, description: 'Pulsera de cuero trenzado con cierre magnético', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 17, name: 'Pack Llaveros x5', category: 'accesorios', price: 1100, description: 'Set de 5 llaveros con diseños variados', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 18, name: 'Souvenir Imán Ciudad', category: 'souvenirs', price: 200, description: 'Imán con ilustración de la ciudad', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 19, name: 'Collar Largo Boho', category: 'accesorios', price: 950, description: 'Collar largo con cuentas y dijes étnicos', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 20, name: 'Pulsera Ajustable Nudos', category: 'pulseras', price: 400, description: 'Pulsera de nudos ajustable estilo surfer', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 21, name: 'Kit Regalo Personalizado', category: 'souvenirs', price: 1500, description: 'Set de regalo con productos a elección', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 22, name: 'Anillo Anatómico Corazón', category: 'accesorios', price: 380, description: 'Anillo con diseño de corazón anatómico', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 23, name: 'Pulsera Multicolor Caramelo', category: 'pulseras', price: 580, description: 'Pulsera con hilos de colores vibrantes estilo caramelo', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 24, name: 'Dije Hoja Minima', category: 'accesorios', price: 220, description: 'Dije de hojas con baño en oro', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 25, name: 'Souvenir Lapiz Decorado', category: 'souvenirs', price: 180, description: 'Lapiz con detalles pintados a mano', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 26, name: 'Pack Pulseras x3', category: 'pulseras', price: 1300, description: 'Set de 3 pulseras combinadas en tonos pastel', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 27, name: 'Collar Cadena Perla', category: 'accesorios', price: 890, description: 'Collar cadena con dije de perla artesanal', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 28, name: 'Imán Corazón Tallado', category: 'souvenirs', price: 160, description: 'Imán en forma de corazón con grabado', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 29, name: 'Pulsera Hilo Ajustable', category: 'pulseras', price: 340, description: 'Pulsera de hilo encerado ajustable', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 30, name: 'Llavero Inicial', category: 'accesorios', price: 260, description: 'Llavero personalizado con inicial de ceramica', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 31, name: 'Souvenir Sobre Madera', category: 'souvenirs', price: 430, description: 'Souvenir en madera grabada con motivo local', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 32, name: 'Pulsera Destellos', category: 'pulseras', price: 530, description: 'Pulsera con cuentas brillantes para ocasiones especiales', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 33, name: 'Collar Turquesa Natural', category: 'accesorios', price: 720, description: 'Collar corto con piedra turquesa natural', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 34, name: 'Pulsera Nudo Celta', category: 'pulseras', price: 470, description: 'Pulsera con nudo celta en hilo encerado', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 35, name: 'Imán Madera Corazón', category: 'souvenirs', price: 190, description: 'Imán de madera con forma de corazón', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 36, name: 'Pack Dijes x4', category: 'accesorios', price: 980, description: 'Set de 4 dijes combinados para personalizar', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 37, name: 'Pulsera Rosa Fuerte', category: 'pulseras', price: 510, description: 'Pulsera en tono rosa intenso con cierre ajustable', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 38, name: 'Souvenir Llavero Ciudad', category: 'souvenirs', price: 240, description: 'Llavero con grabado del nombre de la ciudad', emoji: '🎁', image: '', badge: '', stock: 10 },
  { id: 39, name: 'Aros Cadena Fina', category: 'accesorios', price: 630, description: 'Aros colgantes con cadena fina artesanal', emoji: '💎', image: '', badge: '', stock: 10 },
  { id: 40, name: 'Pulserada Mix 5u', category: 'pulseras', price: 1450, description: 'Pack de 5 pulseras surtidas en colores pastel', emoji: '📿', image: '', badge: '', stock: 10 },
  { id: 41, name: 'Cuaderno Decorado', category: 'accesorios', price: 170, description: 'Cuaderno tapa dura con ilustración artesanal', emoji: '💎', image: '', badge: '', stock: 10 }
];

async function initDB() {
  if (useSqlite) {
    await query(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'pulseras',
      category_id INTEGER DEFAULT 0,
      price REAL NOT NULL,
      description TEXT DEFAULT '',
      emoji TEXT DEFAULT '📿',
      image TEXT DEFAULT '',
      badge TEXT DEFAULT '',
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const sqlLocalProducts = 'INSERT OR IGNORE INTO products (id, name, category, price, description, emoji, image, badge, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await Promise.all(productSeeds.map(p => query(sqlLocalProducts, [p.id, p.name, p.category, p.price, p.description, p.emoji, p.image, p.badge, p.stock])));
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
      active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      customer TEXT,
      status TEXT DEFAULT 'pending',
      mercadopago_id TEXT,
      customer_name TEXT DEFAULT '',
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      customer_address TEXT DEFAULT '',
      subtotal REAL DEFAULT 0,
      shipping_cost REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      customer_name TEXT DEFAULT '',
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '📂',
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      alt TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_primary BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      order_id INTEGER,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      mercadopago_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT '',
      status_detail TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'ARS',
      payment_method_id TEXT DEFAULT '',
      payment_type_id TEXT DEFAULT '',
      raw_response TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await addColumnIfMissing('testimonials', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing('products', 'category_id', 'INTEGER DEFAULT 0');
    await addColumnIfMissing('orders', 'customer_name', 'TEXT DEFAULT \'\'');
    await addColumnIfMissing('orders', 'customer_email', 'TEXT DEFAULT \'\'');
    await addColumnIfMissing('orders', 'customer_phone', 'TEXT DEFAULT \'\'');
    await addColumnIfMissing('orders', 'customer_address', 'TEXT DEFAULT \'\'');
    await addColumnIfMissing('orders', 'subtotal', 'REAL DEFAULT 0');
    await addColumnIfMissing('orders', 'shipping_cost', 'REAL DEFAULT 0');
    await addColumnIfMissing('orders', 'discount', 'REAL DEFAULT 0');
    await addColumnIfMissing('orders', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    console.debug('Tablas de base de datos inicializadas (SQLite)');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'about_text\', \'Cada pieza es artesanal y única, hecha con amor y dedicación en Gualeguay, Entre Ríos.\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_1_title\', \'Hecho a mano\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_1_desc\', \'Cada pieza es artesanal y única\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_2_title\', \'Envío gratis\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_2_desc\', \'En compras mayores a ARS 60.000\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_3_title\', \'Materiales premium\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_3_desc\', \'Seleccionados con cuidado\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_4_title\', \'Para regalar\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'feature_4_desc\', \'Empaques especiales disponibles\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_subtitle\', \'Cinco pasos simples para comprar tu artesanía\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_1_title\', \'1) Elegí productos\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_1_desc\', \'Filtrá por categoría y elegí tu pieza del catálogo.\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_2_title\', \'2) Sumá al carrito\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_2_desc\', \'Presioná "Agregar" para guardar tu selección.\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_3_title\', \'3) Revisá el carrito\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_3_desc\', \'Verificá cantidad, subtotal y total antes de pagar.\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_4_title\', \'4) Pagá con MercadoPago\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_4_desc\', \'Ingresás al checkout para completar el pago de forma segura.\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_5_title\', \'5) Confirmación\')');
    await query('INSERT OR IGNORE INTO site_texts (key, value) VALUES (\'process_step_5_desc\', \'Al finalizar, vas a ver el comprobante en pantalla.\')');

    const categorySeeds = [
      ['pulseras', 'Pulseras artesanales de hilo, cuero y cerámica', '📿', 1],
      ['accesorios', 'Cadenas, anillos, aros y dijes únicos', '💎', 2],
      ['souvenirs', 'Regalos y recuerdos de Gualeguay', '🎁', 3]
    ];
    for (const [slug, description, icon, sort_order] of categorySeeds) {
      try {
        await query('INSERT INTO categories (name, slug, description, icon, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING', [slug, slug, description, icon, sort_order]);
      } catch (err) {
        console.error('Error seed categories:', err.message);
      }
    }

    await query('UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = products.category) WHERE category_id IS NULL OR category_id = 0');
    return;
  }

  const statements = [
    'CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, description TEXT DEFAULT \'\', icon TEXT DEFAULT \'📂\', sort_order INTEGER DEFAULT 0, active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT DEFAULT \'pulseras\', category_id INTEGER, price REAL NOT NULL, description TEXT DEFAULT \'\', emoji TEXT DEFAULT \'📿\', image TEXT DEFAULT \'\', badge TEXT DEFAULT \'\', stock INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS site_texts (id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT DEFAULT \'\', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS testimonials (id SERIAL PRIMARY KEY, name TEXT NOT NULL, comment TEXT NOT NULL, rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5), image TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, items JSONB NOT NULL, total REAL NOT NULL, customer JSONB, status TEXT DEFAULT \'pending\', mercadopago_id TEXT, customer_name TEXT DEFAULT \'\', customer_email TEXT DEFAULT \'\', customer_phone TEXT DEFAULT \'\', customer_address TEXT DEFAULT \'\', subtotal REAL DEFAULT 0, shipping_cost REAL DEFAULT 0, discount REAL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS subscribers (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, customer_name TEXT DEFAULT \'\', rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), comment TEXT DEFAULT \'\', active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS product_images (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, url TEXT NOT NULL, alt TEXT DEFAULT \'\', sort_order INTEGER DEFAULT 0, is_primary BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS inventory_movements (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL, type TEXT NOT NULL, quantity INTEGER NOT NULL, previous_stock INTEGER NOT NULL, new_stock INTEGER NOT NULL, order_id INTEGER, notes TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS order_status_history (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, status TEXT NOT NULL, notes TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, order_id INTEGER, mercadopago_id TEXT UNIQUE NOT NULL, status TEXT DEFAULT \'\', status_detail TEXT DEFAULT \'\', amount REAL DEFAULT 0, currency TEXT DEFAULT \'ARS\', payment_method_id TEXT DEFAULT \'\', payment_type_id TEXT DEFAULT \'\', raw_response TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      console.error('Error ejecutando SQL:', err.message);
    }
  }

  console.debug('Tablas de base de datos inicializadas (PostgreSQL)');
  const sqlProducts = 'INSERT INTO products (id, name, category, price, description, emoji, image, badge, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING';
  await Promise.all(productSeeds.map(p => query(sqlProducts, [p.id, p.name, p.category, p.price, p.description, p.emoji, p.image, p.badge, p.stock])));
  const seeds = [
    ['about_text', 'Cada pieza es artesanal y única, hecha con amor y dedicación en Gualeguay, Entre Ríos.'],
    ['feature_1_title', 'Hecho a mano'],
    ['feature_1_desc', 'Cada pieza es artesanal y única'],
    ['feature_2_title', 'Envío gratis'],
    ['feature_2_desc', 'En compras mayores a ARS 60.000'],
    ['feature_3_title', 'Materiales premium'],
    ['feature_3_desc', 'Seleccionados con cuidado'],
    ['feature_4_title', 'Para regalar'],
    ['feature_4_desc', 'Empaques especiales disponibles'],
    ['process_subtitle', 'Cinco pasos simples para comprar tu artesanía'],
    ['process_step_1_title', '1) Elegí productos'],
    ['process_step_1_desc', 'Filtrá por categoría y elegí tu pieza del catálogo.'],
    ['process_step_2_title', '2) Sumá al carrito'],
    ['process_step_2_desc', 'Presioná "Agregar" para guardar tu selección.'],
    ['process_step_3_title', '3) Revisá el carrito'],
    ['process_step_3_desc', 'Verificá cantidad, subtotal y total antes de pagar.'],
    ['process_step_4_title', '4) Pagá con MercadoPago'],
    ['process_step_4_desc', 'Ingresás al checkout para completar el pago de forma segura.'],
    ['process_step_5_title', '5) Confirmación'],
    ['process_step_5_desc', 'Al finalizar, vas a ver el comprobante en pantalla.']
  ];
  for (const [key, value] of seeds) {
    try {
      await query('INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
    } catch (err) {
      console.error('Error seed site_texts:', err.message);
    }
  }

  const categorySeeds = [
    ['pulseras', 'Pulseras artesanales de hilo, cuero y cerámica', '📿', 1],
    ['accesorios', 'Cadenas, anillos, aros y dijes únicos', '💎', 2],
    ['souvenirs', 'Regalos y recuerdos de Gualeguay', '🎁', 3]
  ];
  for (const [slug, description, icon, sort_order] of categorySeeds) {
    try {
      await query('INSERT INTO categories (name, slug, description, icon, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING', [slug, slug, description, icon, sort_order]);
    } catch (err) {
      console.error('Error seed categories:', err.message);
    }
  }

  await query('UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = products.category) WHERE category_id IS NULL OR category_id = 0');
}

module.exports = { query, initDB, pool, db, connectionString: !!connectionString };
