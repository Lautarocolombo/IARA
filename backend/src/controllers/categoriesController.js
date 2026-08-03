const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getCategories = async (req, res) => {
  try {
    const result = await query('SELECT id, name, slug, description, active, sort_order as orden, created_at, updated_at FROM categories ORDER BY active DESC, sort_order ASC, name ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo categorías:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createCategory = async (req, res) => {
  const { name, slug, description = '', active = true, orden = 0 } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
  try {
    const result = await query(
      'INSERT INTO categories (name, slug, description, active, orden) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, slug, description, active, orden]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    setParts.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  values.push(id);
  try {
    const result = await query(`UPDATE categories SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteCategory = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
