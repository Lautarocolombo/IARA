const { query } = require('../lib/db');
const { productSchema } = require('../lib/validators');
const logger = require('../lib/logger');
const { deleteImageAsset, getPublicUrl } = require('../lib/upload');
const { syncBus } = require('../routes/sync');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const xlsx = require('xlsx');

let productsSchemaVerified = false;
let productImagesSchemaVerified = false;

async function ensureProductsSchema() {
  if (productsSchemaVerified) return;
  try {
    const colsResult = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'public'`);
    if (!colsResult || !Array.isArray(colsResult.rows) || colsResult.rows.length === 0) {
      return;
    }
    const existing = new Set(colsResult.rows.map(r => r.column_name));
    const needed = ['id', 'name', 'slug', 'category', 'price', 'description', 'emoji', 'image', 'badge', 'stock', 'featured', 'active', 'deleted', 'sku', 'tenant_id', 'created_at', 'updated_at'];
    const missing = needed.filter(c => !existing.has(c));
    if (missing.length > 0) {
      logger.warn({ missing }, 'Faltan columnas en products, intentando agregarlas');
      for (const col of missing) {
        try {
          if (col === 'featured') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE');
          else if (col === 'active') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE');
          else if (col === 'deleted') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE');
          else if (col === 'slug') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT \'\'');
          else if (col === 'sku') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT \'\'');
          else if (col === 'tenant_id') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT \'default\'');
          else if (col === 'stock') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0');
          else if (col === 'badge') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT \'\'');
          else if (col === 'emoji') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT \'📿\'');
          else if (col === 'image') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT DEFAULT \'\'');
          else if (col === 'description') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT \'\'');
          else if (col === 'category') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT \'pulseras\'');
          else if (col === 'price') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS price REAL DEFAULT 0');
          else if (col === 'name') await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT DEFAULT \'\'');
          else if (col === 'id') continue;
          else if (col === 'created_at' || col === 'updated_at') continue;
        } catch (e) {
          logger.debug({ col, err: e.message }, 'No se pudo agregar columna');
        }
      }
      const verifyResult = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'public'`);
      const currentExisting = new Set((verifyResult.rows || []).map(r => r.column_name));
      const stillMissing = needed.filter(c => !currentExisting.has(c));
      if (stillMissing.length === 0) {
        productsSchemaVerified = true;
      }
    } else {
      productsSchemaVerified = true;
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo verificar esquema de products');
  }
}

async function ensureProductImagesSchema() {
  if (productImagesSchemaVerified) return;
  try {
    const colsResult = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'product_images' AND table_schema = 'public'`);
    if (!colsResult || !Array.isArray(colsResult.rows) || colsResult.rows.length === 0) {
      return;
    }
    const existing = new Set(colsResult.rows.map(r => r.column_name));
    const needed = ['id', 'product_id', 'url', 'alt', 'filename', 'cloudinary_public_id', 'orden', 'es_principal', 'descripcion', 'categoria', 'tenant_id', 'created_at'];
    const missing = needed.filter(c => !existing.has(c));
    if (missing.length > 0) {
      logger.warn({ missing }, 'Faltan columnas en product_images, intentando agregarlas');
      for (const col of missing) {
        try {
          if (col === 'cloudinary_public_id') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT DEFAULT \'\'');
          else if (col === 'alt') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT \'\'');
          else if (col === 'descripcion') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT \'\'');
          else if (col === 'categoria') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT \'\'');
          else if (col === 'filename') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS filename TEXT DEFAULT \'\'');
          else if (col === 'tenant_id') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT \'default\'');
          else if (col === 'orden') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0');
          else if (col === 'es_principal') await query('ALTER TABLE product_images ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT FALSE');
          else if (col === 'product_id' || col === 'url' || col === 'id' || col === 'created_at') continue;
        } catch (e) {
          logger.debug({ col, err: e.message }, 'No se pudo agregar columna en product_images');
        }
      }
      const verifyResult = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'product_images' AND table_schema = 'public'`);
      const currentExisting = new Set((verifyResult.rows || []).map(r => r.column_name));
      const stillMissing = needed.filter(c => !currentExisting.has(c));
      if (stillMissing.length === 0) {
        productImagesSchemaVerified = true;
      }
    } else {
      productImagesSchemaVerified = true;
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo verificar esquema de product_images');
  }
}

function slugify(text) {
  if (!text) return '';
  return String(text)
    .toString()
    .toLowerCase()
    .trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function attachImagesToProducts(products, baseUrl) {
  if (!products || !products.length) {
    return products || [];
  }

  const ids = products.map(p => p.id);
  if (!ids.length) {
    return products;
  }

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  let imageRows = [];
  try {
    const result = await query(
      `SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY orden ASC, id ASC`,
      ids
    );
    imageRows = result.rows || [];
  } catch (err) {
    logger.warn({ err: err.message }, 'Error obteniendo imágenes de productos');
    return products;
  }

  const resolvedBaseUrl = baseUrl || process.env.BACKEND_URL || process.env.SITE_URL || '';
  const byProduct = {};
  imageRows.forEach(img => {
    const resolved = { ...img, url: getPublicUrl(img.url, resolvedBaseUrl) };
    if (!byProduct[img.product_id]) byProduct[img.product_id] = [];
    byProduct[img.product_id].push(resolved);
  });

const BLOB_URL_RE = /^https?:\/\/[^/]+\.blob\.vercel-storage\.com/;

  return products.map(p => {
    const imgs = byProduct[p.id] || [];
    const principal = imgs.find(i => i.es_principal) || imgs.find(i => BLOB_URL_RE.test(i.url)) || imgs[0];
    const principalUrl = principal ? (principal.url || getPublicUrl(principal.url, resolvedBaseUrl)) : '';
    const legacyImage = p.image ? getPublicUrl(p.image, resolvedBaseUrl) : '';
    const blobImage = imgs.find(i => BLOB_URL_RE.test(i.url));
    return {
      ...p,
      images: imgs,
      image: principalUrl || (blobImage ? blobImage.url : legacyImage)
    };
  });
}

async function parseCSV(filePath) {
  const results = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = [];
  let firstLine = true;
  for await (const line of rl) {
    if (firstLine) {
      headers = line.split(',').map(h => h.trim().toLowerCase());
      firstLine = false;
      continue;
    }
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    if (obj.nombre || obj.name) results.push(obj);
  }
  return results;
}

async function parseExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? String(values[idx]).trim() : '';
    });
    if (obj.nombre || obj.name) results.push(obj);
  }
  return results;
}

const bulkImportProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió archivo' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let rows = [];

  try {
    if (ext === '.csv') {
      rows = await parseCSV(req.file.path);
    } else if (ext === '.xlsx' || ext === '.xls') {
      const buffer = fs.readFileSync(req.file.path);
      rows = await parseExcel(buffer);
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usá CSV o Excel.' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Error parseando archivo: ' + err.message });
  }

  let success = 0;
  let errors = 0;
  const errorDetails = [];

  for (const row of rows) {
    const rowNum = success + errors + 1;
    try {
      const data = {
        name: row.nombre || row.name || '',
        slug: row.slug || '',
        category: row.categoria || row.category || 'pulseras',
        price: Number(row.precio || row.price || 0),
        description: row.descripcion || row.description || '',
        emoji: row.emoji || '📿',
        image: row.imagen || row.image || '',
        badge: row.badge || '',
        stock: Number(row.stock || 0),
        featured: row.featured === 'true' || row.featured === '1',
        active: row.active !== 'false' && row.active !== '0',
        sku: row.sku || ''
      };

      if (!data.slug) data.slug = slugify(data.name);

      const validation = productSchema.safeParse(data);
      if (!validation.success) {
        errors++;
        errorDetails.push({ row: rowNum, error: validation.error.issues[0]?.message || 'Datos inválidos' });
        continue;
      }

      const existing = await query('SELECT id FROM products WHERE name = $1 OR slug = $2', [data.name, data.slug]);
      if (existing.rows.length > 0) {
        await query(
          'UPDATE products SET category = $1, price = $2, description = $3, emoji = $4, image = $5, badge = $6, stock = $7, featured = $8, active = $9, sku = $10, slug = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12',
          [data.category, Number(data.price), data.description, data.emoji, data.image, data.badge, Number(data.stock), data.featured, data.active, data.sku || '', data.slug, existing.rows[0].id]
        );
      } else {
        await query(
          'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
          [data.name, data.slug, data.category, Number(data.price), data.description, data.emoji, data.image, data.badge, Number(data.stock), data.featured, data.active, data.sku || '']
        );
      }
      success++;
    } catch (err) {
      errors++;
      errorDetails.push({ row: rowNum, error: err.message });
    }
  }

  if (req.file.path && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }
  res.json({ ok: true, total: rows.length, success, errors, errorsDetail: errorDetails });
  try { syncBus.emit('products_updated', {}); } catch (e) { /* noop */ }
};

const getFeaturedProducts = async (req, res) => {
  try {
    await ensureProductsSchema();
    await ensureProductImagesSchema();
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query(`SELECT * FROM products WHERE active = TRUE AND deleted = FALSE AND featured = TRUE AND tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default') ORDER BY id ASC LIMIT 2`);
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(enriched);
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Error obteniendo productos destacados');
    if (err.message && (err.message.includes('does not exist') || err.message.includes('no existe') || err.code === '42P01' || err.code === '42703')) {
      logger.warn('Esquema de productos incompleto en /api/products/featured, devolviendo array vacío');
      return res.status(200).json([]);
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicProducts = async (req, res) => {
  try {
    await ensureProductsSchema();
    await ensureProductImagesSchema();
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const { category, minPrice, maxPrice } = req.query;
    let where = 'WHERE active = TRUE AND deleted = FALSE AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')';
    const params = [];
    if (category) {
      const idx = params.length + 1;
      where += ` AND category = $${idx}`;
      params.push(category);
    }
    if (minPrice !== undefined && minPrice !== '') {
      const idx = params.length + 1;
      where += ` AND price >= $${idx}`;
      params.push(Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const idx = params.length + 1;
      where += ` AND price <= $${idx}`;
      params.push(Number(maxPrice));
    }
    const result = await query(`SELECT * FROM products ${where} ORDER BY id ASC`, params);
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(enriched);
    try { syncBus.emit('products_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error obteniendo productos:', err);
    if (err.message && (err.message.includes('does not exist') || err.message.includes('no existe') || err.code === '42P01' || err.code === '42703')) {
      logger.warn('Esquema de productos incompleto, devolviendo array vacío');
      return res.status(200).json([]);
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const searchProducts = async (req, res) => {
  try {
    await ensureProductsSchema();
    await ensureProductImagesSchema();
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json([]);
    }
    const { category, minPrice, maxPrice } = req.query;
    let where = 'WHERE active = TRUE AND deleted = FALSE AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')';
    const params = [];
    if (q) {
      const idx = params.length + 1;
      where += ` AND (name LIKE $${idx} OR description LIKE $${idx} OR category LIKE $${idx} OR sku LIKE $${idx})`;
      params.push(`%${q}%`);
    }
    if (category) {
      const idx = params.length + 1;
      where += ` AND category = $${idx}`;
      params.push(category);
    }
    if (minPrice !== undefined && minPrice !== '') {
      const idx = params.length + 1;
      where += ` AND price >= $${idx}`;
      params.push(Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const idx = params.length + 1;
      where += ` AND price <= $${idx}`;
      params.push(Number(maxPrice));
    }
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query(`SELECT * FROM products ${where} ORDER BY id ASC`, params);
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    res.json(enriched);
  } catch (err) {
    logger.error('Error buscando productos:', err);
    if (err.message && (err.message.includes('does not exist') || err.message.includes('no existe') || err.code === '42P01' || err.code === '42703')) {
      logger.warn('Esquema de productos incompleto en búsqueda, devolviendo array vacío');
      return res.status(200).json([]);
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const { sku, q, category, active, page, limit, sort_by, sort_order } = req.query;

    let where = 'WHERE deleted = FALSE';
    const params = [];

    if (sku) {
      const idx = params.length + 1;
      where += ` AND sku = $${idx}`;
      params.push(sku);
    }
    if (q) {
      const idx = params.length + 1;
      where += ` AND (name LIKE $${idx} OR description LIKE $${idx} OR sku LIKE $${idx})`;
      params.push(`%${q}%`);
    }
    if (category) {
      const idx = params.length + 1;
      where += ` AND category = $${idx}`;
      params.push(category);
    }
    if (active !== undefined && active !== '') {
      const idx = params.length + 1;
      where += ` AND active = $${idx}`;
      params.push(active === 'true');
    }

    if (!page && !limit) {
      const result = await query(`SELECT * FROM products ${where} ORDER BY id ASC`, params);
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    return res.json({ products: enriched, total: enriched.length, page: 1, pages: 1, hasMore: false });
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 30;
    const offset = (pageNum - 1) * limitNum;
    const sortField = ['name', 'price', 'created_at', 'updated_at', 'stock', 'id'].includes(sort_by) ? sort_by : 'id';
    const sortDir = sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    params.push(limitNum, offset);
    const countResult = await query(`SELECT COUNT(*) as total FROM products ${where}`, params.slice(0, -2));

    const total = Number(countResult.rows[0]?.total || 0);
    const result = await query(
      `SELECT * FROM products ${where} ORDER BY ${sortField} ${sortDir} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const enriched = await attachImagesToProducts(result.rows, baseUrl);

    res.json({
      products: enriched,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total
    });
  } catch (err) {
    logger.error('Error obteniendo productos (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getProductById = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM products WHERE id = $1 AND deleted = FALSE AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(enriched[0]);
    try { syncBus.emit('products_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error obteniendo producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createProduct = async (req, res) => {
  try {
    const data = productSchema.parse(req.body);
    const slug = data.slug || slugify(data.name);

    const existingSlug = await query('SELECT id FROM products WHERE slug = $1 AND deleted = FALSE', [slug]);
    if (existingSlug.rows.length > 0) {
      return res.status(409).json({ error: `Ya existe un producto con el slug "${slug}"` });
    }

    const result = await query(
      `INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, COALESCE(current_setting('app.current_tenant', TRUE), 'default')) RETURNING *`,
      [data.name, slug, data.category, Number(data.price), data.description || '', data.emoji || '📿', data.image || '', data.badge || '', Number(data.stock), data.featured || false, data.active !== false, data.sku || '']
    );
    logger.info({ productId: result.rows[0].id, name: data.name, slug }, 'createProduct: producto creado');
    res.status(201).json(result.rows[0]);
    try { syncBus.emit('products_updated', { id: result.rows[0].id }); } catch (e) { /* noop */ }
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
    }
    logger.error('Error creando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const data = productSchema.partial().parse(req.body);

    if (data.slug) {
      const existingSlug = await query('SELECT id FROM products WHERE slug = $1 AND id != $2 AND deleted = FALSE', [data.slug, id]);
      if (existingSlug.rows.length > 0) {
        return res.status(409).json({ error: `Ya existe un producto con el slug "${data.slug}"` });
      }
    }

    const rawFields = Object.keys(data);
    const fields = rawFields.filter(f => f !== 'image' || data[f]);
    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');
    const values = fields.map(f => (['price', 'stock'].includes(f) ? Number(data[f]) : data[f]));
    values.push(id);
    const result = await query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} AND deleted = FALSE RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    logger.info({ productId: id, fields }, 'updateProduct: producto actualizado');
    res.json(result.rows[0]);
    try { syncBus.emit('products_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
    }
    logger.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toggleProductStatus = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query(
      'UPDATE products SET active = NOT active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted = FALSE RETURNING id, active',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true, active: result.rows[0].active });
    try { syncBus.emit('products_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error cambiando estado del producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const orderCheck = await query('SELECT COUNT(*) as count FROM orders WHERE CAST(items AS TEXT) LIKE $1', [`%${id}%`]);
    const hasHistoricalOrders = Number(orderCheck.rows[0]?.count || 0) > 0;

    const imagesResult = await query('SELECT url, cloudinary_public_id, filename FROM product_images WHERE product_id = $1', [id]);
    for (const img of imagesResult.rows) {
      try {
        await deleteImageAsset(img);
      } catch (imgErr) {
        logger.warn({ err: imgErr.message }, 'Error eliminando imagen individual al borrar producto');
      }
    }
    await query('DELETE FROM product_images WHERE product_id = $1', [id]);

    if (hasHistoricalOrders) {
      await query(
        'UPDATE products SET deleted = TRUE, active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );
    } else {
      const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ ok: true, logical: hasHistoricalOrders });
    logger.info({ productId: id, logical: hasHistoricalOrders }, 'deleteProduct: producto eliminado');
    try { syncBus.emit('products_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Error eliminando producto');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const duplicateProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const original = await query('SELECT * FROM products WHERE id = $1 AND deleted = FALSE', [id]);
    if (original.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    const p = original.rows[0];
    const newName = p.name + ' (copia)';
    const newSlug = p.slug ? p.slug + '-copia' : slugify(newName);

    const existingSlug = await query('SELECT id FROM products WHERE slug = $1', [newSlug]);
    let finalSlug = newSlug;
    if (existingSlug.rows.length > 0) {
      finalSlug = newSlug + '-' + Date.now();
    }

    const result = await query(
      'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING *',
      [newName, finalSlug, p.category, Number(p.price), p.description, p.emoji, p.image, p.badge, Number(p.stock), false, false, p.sku]
    );

    const images = await query('SELECT url, filename, cloudinary_public_id, orden, es_principal, descripcion, categoria FROM product_images WHERE product_id = $1 ORDER BY orden ASC', [id]);
    for (const img of images.rows) {
      await query(
        'INSERT INTO product_images (product_id, url, filename, cloudinary_public_id, orden, es_principal, descripcion, categoria, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
        [result.rows[0].id, img.url, img.filename, img.cloudinary_public_id, img.orden, img.es_principal, img.descripcion, img.categoria]
      );
    }

    res.status(201).json(result.rows[0]);
    try { syncBus.emit('products_updated', { id: result.rows[0].id }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error duplicando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const syncToNeon = async (req, res) => {
  try {
    let products = Array.isArray(req.body) ? req.body : [];
    if (!products.length) {
      const result = await query('SELECT * FROM products WHERE deleted = FALSE ORDER BY id ASC');
      products = result.rows;
    }
    const results = { created: 0, updated: 0, errors: 0, images: 0 };

    for (const p of products) {
      try {
        const exists = await query('SELECT id FROM products WHERE id = $1', [Number(p.id)]);
        if (exists.rows.length > 0) {
          await query(
            'UPDATE products SET name = $1, slug = $2, category = $3, price = $4, description = $5, emoji = $6, image = $7, badge = $8, stock = $9, featured = $10, active = $11, sku = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13',
            [p.name, p.slug || slugify(p.name), p.category, Number(p.price), p.description || '', p.emoji || '📿', p.image || '', p.badge || '', Number(p.stock), p.featured || false, p.active !== false, p.sku || '', Number(p.id)]
          );
          results.updated += 1;
        } else {
          await query(
            'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
            [p.name, p.slug || slugify(p.name), p.category, Number(p.price), p.description || '', p.emoji || '📿', p.image || '', p.badge || '', Number(p.stock), p.featured || false, p.active !== false, p.sku || '']
          );
          results.created += 1;
        }
        if (p.images && Array.isArray(p.images)) {
          for (const img of p.images) {
            try {
              const imgExists = await query('SELECT id FROM product_images WHERE product_id = $1 AND (url = $2 OR filename = $3)', [Number(p.id), img.url, img.filename || '']);
              if (imgExists.rows.length > 0) {
                await query('UPDATE product_images SET url = $1, filename = $2, orden = $3, es_principal = $4, descripcion = $5, categoria = $6 WHERE id = $7', [img.url, img.filename || '', Number(img.orden) || 0, img.es_principal || false, img.descripcion || '', img.categoria || '', imgExists.rows[0].id]);
              } else {
                await query('INSERT INTO product_images (product_id, url, filename, orden, es_principal, descripcion, categoria, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))', [Number(p.id), img.url, img.filename || '', Number(img.orden) || 0, img.es_principal || false, img.descripcion || '', img.categoria || '']);
              }
              results.images += 1;
            } catch (imgErr) {
              results.errors += 1;
            }
          }
        }
      } catch (err) {
        results.errors += 1;
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    logger.error('Error sincronizando productos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'Se requiere un array de IDs' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`UPDATE products SET deleted = TRUE, active = FALSE WHERE id IN (${placeholders}) AND tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default')`, ids);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    logger.error('Error eliminando productos en bloque:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const bulkToggleProducts = async (req, res) => {
  try {
    const { ids, active } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || active === undefined) {
      return res.status(400).json({ error: 'Se requiere un array de IDs y el estado active' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`UPDATE products SET active = $${ids.length + 1} WHERE id IN (${placeholders}) AND tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default')`, [...ids, active]);
    res.json({ updated: result.rowCount });
  } catch (err) {
    logger.error('Error cambiando estado de productos en bloque:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getFeaturedProducts,
  getPublicProducts,
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  duplicateProduct,
  searchProducts,
  syncToNeon,
  bulkImportProducts,
  bulkDeleteProducts,
  bulkToggleProducts,
  attachImagesToProducts
};
