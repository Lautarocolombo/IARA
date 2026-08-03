const { query } = require('../lib/db');
const { productSchema } = require('../lib/validators');
const logger = require('../lib/logger');
const { deleteFromCloudinary } = require('../lib/upload');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const xlsx = require('xlsx');

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

  const importId = Date.now();
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
    try {
      const data = {
        name: row.nombre || row.name || '',
        category: row.categoria || row.category || 'pulseras',
        price: Number(row.precio || row.price || 0),
        description: row.descripcion || row.description || '',
        emoji: row.emoji || '📿',
        image: row.imagen || row.image || '',
        badge: row.badge || '',
        stock: Number(row.stock || 0),
        featured: row.featured === 'true' || row.featured === '1',
        active: row.active !== 'false' && row.active !== '0'
      };

      const validation = productSchema.safeParse(data);
      if (!validation.success) {
        errors++;
        errorDetails.push({ row: success + errors, error: validation.error.errors[0]?.message || 'Datos inválidos' });
        continue;
      }

      const existing = await query('SELECT id FROM products WHERE name = $1', [data.name]);
      if (existing.rows.length > 0) {
        await query(
          'UPDATE products SET category = $1, price = $2, description = $3, emoji = $4, image = $5, badge = $6, stock = $7, featured = $8, active = $9, updated_at = CURRENT_TIMESTAMP WHERE id = $10',
          [data.category, Number(data.price), data.description, data.emoji, data.image, data.badge, Number(data.stock), data.featured, data.active, existing.rows[0].id]
        );
      } else {
        await query(
          'INSERT INTO products (name, category, price, description, emoji, image, badge, stock, featured, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [data.name, data.category, Number(data.price), data.description, data.emoji, data.image, data.badge, Number(data.stock), data.featured, data.active]
        );
      }
      success++;
    } catch (err) {
      errors++;
      errorDetails.push({ row: success + errors, error: err.message });
    }
  }

  await query(
    'INSERT INTO product_bulk_imports (filename, status, total_rows, success_rows, error_rows, errors) VALUES ($1, $2, $3, $4, $5, $6)',
    [req.file.originalname, 'completed', rows.length, success, errors, JSON.stringify(errorDetails)]
  );

  if (req.file.path && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }
  res.json({ ok: true, total: rows.length, success, errors, errorsDetail: errorDetails });
};

const getPublicProducts = async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo productos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const searchProducts = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const result = await query(
      "SELECT * FROM products WHERE name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 ORDER BY id ASC",
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Error buscando productos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo productos (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createProduct = async (req, res) => {
  try {
    const data = productSchema.parse(req.body);
    const result = await query(
      'INSERT INTO products (name, category, price, description, emoji, image, badge, stock, featured, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [data.name, data.category, Number(data.price), data.description || '', data.emoji || '📿', data.image || '', data.badge || '', Number(data.stock), data.featured || false, data.active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Datos inválidos' });
    }
    logger.error('Error creando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const data = productSchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');
    const values = fields.map(f => (['price', 'stock'].includes(f) ? Number(data[f]) : data[f]));
    values.push(id);
    const result = await query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Datos inválidos' });
    }
    logger.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const imagesResult = await query('SELECT cloudinary_public_id FROM product_images WHERE product_id = $1', [id]);
    for (const img of imagesResult.rows) {
      if (img.cloudinary_public_id) {
        await deleteFromCloudinary(img.cloudinary_public_id);
      }
    }
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const syncToNeon = async (req, res) => {
  try {
    const products = Array.isArray(req.body) ? req.body : [];
    const results = { created: 0, updated: 0, errors: 0 };

    for (const p of products) {
      try {
        const exists = await query('SELECT id FROM products WHERE id = $1', [Number(p.id)]);
        if (exists.rows.length > 0) {
      await query(
             'UPDATE products SET name = $1, category = $2, price = $3, description = $4, emoji = $5, image = $6, badge = $7, stock = $8, featured = $9, active = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11',
             [p.name, p.category, Number(p.price), p.description || '', p.emoji || '📿', p.image || '', p.badge || '', Number(p.stock), p.featured || false, p.active !== false, Number(p.id)]
           );
           results.updated += 1;
         } else {
           await query(
             'INSERT INTO products (name, category, price, description, emoji, image, badge, stock, featured, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
             [p.name, p.category, Number(p.price), p.description || '', p.emoji || '📿', p.image || '', p.badge || '', Number(p.stock), p.featured || false, p.active !== false]
           );
          results.created += 1;
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

module.exports = { getPublicProducts, getAdminProducts, createProduct, updateProduct, deleteProduct, searchProducts, syncToNeon, bulkImportProducts };
