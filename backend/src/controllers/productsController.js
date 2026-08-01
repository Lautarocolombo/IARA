const { query } = require('../lib/db');
const { productSchema } = require('../lib/validators');
const logger = require('../lib/logger');

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
      'INSERT INTO products (name, category, price, description, emoji, image, badge, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [data.name, data.category, Number(data.price), data.description || '', data.emoji || '📿', data.image || '', data.badge || '', Number(data.stock)]
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
            'UPDATE products SET name = $1, category = $2, price = $3, description = $4, emoji = $5, image = $6, badge = $7, stock = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9',
            [p.name, p.category, Number(p.price), p.description || '', p.emoji || '📿', p.image || '', p.badge || '', Number(p.stock), Number(p.id)]
          );
          results.updated += 1;
        } else {
          await query(
            'INSERT INTO products (name, category, price, description, emoji, image, badge, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [p.name, p.category, Number(p.price), p.description || '', p.emoji || '📿', p.image || '', p.badge || '', Number(p.stock)]
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

module.exports = { getPublicProducts, getAdminProducts, createProduct, updateProduct, deleteProduct, syncToNeon };
