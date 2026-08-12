const { query } = require('../lib/db');
const { productSchema } = require('../lib/validators');
const logger = require('../lib/logger');
const { deleteImageAsset, getPublicUrl } = require('../lib/upload');
const { syncBus } = require('../routes/sync');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const xlsx = require('xlsx');

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

  return products.map(p => {
    const imgs = byProduct[p.id] || [];
    const principal = imgs.find(i => i.es_principal) || imgs[0];
    const principalUrl = principal ? (principal.url || getPublicUrl(principal.url, resolvedBaseUrl)) : '';
    const legacyImage = p.image ? getPublicUrl(p.image, resolvedBaseUrl) : '';
    return {
      ...p,
      images: imgs,
      image: principalUrl || legacyImage
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

const getPublicProducts = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM products WHERE active = TRUE AND deleted = FALSE ORDER BY id ASC');
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(enriched);
    try { syncBus.emit('products_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error obteniendo productos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const searchProducts = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query(
      'SELECT * FROM products WHERE active = TRUE AND deleted = FALSE AND (name LIKE $1 OR description LIKE $1 OR category LIKE $1 OR sku LIKE $1) ORDER BY id ASC',
      [`%${q}%`]
    );
    const enriched = await attachImagesToProducts(result.rows, baseUrl);
    res.json(enriched);
  } catch (err) {
    logger.error('Error buscando productos:', err);
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
    const result = await query('SELECT * FROM products WHERE id = $1 AND deleted = FALSE', [id]);
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

    const fields = Object.keys(data);
    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');
    const values = fields.map(f => (['price', 'stock'].includes(f) ? Number(data[f]) : data[f]));
    values.push(id);
    const result = await query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} AND deleted = FALSE RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
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

module.exports = {
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
  attachImagesToProducts
};
