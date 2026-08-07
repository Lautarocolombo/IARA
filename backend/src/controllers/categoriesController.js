const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { saveUploadedFile } = require('../lib/upload');

const ALLOWED_CATEGORY_COLUMNS = ['name', 'slug', 'description', 'active', 'orden', 'emoji', 'image'];

const getCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.name, c.slug, c.description, c.active, c.orden, c.emoji, c.image, c.created_at, c.updated_at, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.slug AND p.deleted = FALSE
       GROUP BY c.id
       ORDER BY c.orden ASC, c.active DESC, c.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo categorías:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.name, c.slug, c.description, c.emoji, c.image, c.orden, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.slug AND p.active = TRUE AND p.deleted = FALSE
       WHERE c.active = TRUE
       GROUP BY c.id
       ORDER BY c.orden ASC, c.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo categorías públicas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createCategory = async (req, res) => {
  let { name, slug, description = '', active = true, orden = 0, emoji = '', image = '' } = req.body || {};
  if (req.file) {
    image = await saveUploadedFile(req.file);
  }
  if (typeof active === 'string') active = active !== 'false';
  if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
  try {
    const result = await query(
      'INSERT INTO categories (name, slug, description, active, orden, emoji, image) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, slug, description, active !== false, Number(orden) || 0, emoji || '', image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre o slug' });
    }
    logger.error('Error creando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  if (req.file) {
    updates.image = await saveUploadedFile(req.file);
  }
  const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED_CATEGORY_COLUMNS.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    setParts.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  values.push(id);
  try {
    const result = await query(`UPDATE categories SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre o slug' });
    }
    logger.error('Error actualizando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCategoryOrder = async (req, res) => {
  const { orden } = req.body || {};
  if (!Array.isArray(orden)) return res.status(400).json({ error: 'Se requiere un array de órdenes con { id, orden }' });
  try {
    for (const item of orden) {
      if (item.id !== undefined && item.orden !== undefined) {
        await query(
          'UPDATE categories SET orden = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [Number(item.orden), Number(item.id)]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error actualizando orden de categorías:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteCategory = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const catResult = await query('SELECT slug FROM categories WHERE id = $1', [id]);
    if (catResult.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    const slug = catResult.rows[0].slug;

    const countResult = await query('SELECT COUNT(*) as count FROM products WHERE category = $1 AND deleted = FALSE', [slug]);
    const productCount = Number(countResult.rows[0]?.count || 0);

    await query('UPDATE products SET category = \'\' WHERE category = $1', [slug]);
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ ok: true, reassigned: productCount, productCount });
  } catch (err) {
    logger.error('Error eliminando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getCategories, getPublicCategories, createCategory, updateCategory, updateCategoryOrder, deleteCategory };
