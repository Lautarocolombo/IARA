const { query } = require('../lib/db');

const getAdminCategories = async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo categorías:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createCategory = async (req, res) => {
  const { name, slug, description, icon, sort_order } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
  try {
    const result = await query(
      'INSERT INTO categories (name, slug, description, icon, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, slug, description || '', icon || '📂', sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese slug' });
    console.error('Error creando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, description, icon, sort_order, active } = req.body || {};
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx}`); values.push(name); idx++; }
    if (slug !== undefined) { fields.push(`slug = $${idx}`); values.push(slug); idx++; }
    if (description !== undefined) { fields.push(`description = $${idx}`); values.push(description); idx++; }
    if (icon !== undefined) { fields.push(`icon = $${idx}`); values.push(icon); idx++; }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx}`); values.push(sort_order); idx++; }
    if (active !== undefined) { fields.push(`active = $${idx}`); values.push(active); idx++; }
    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    values.push(id);
    const result = await query(`UPDATE categories SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese slug' });
    console.error('Error actualizando categoría:', err);
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
    console.error('Error eliminando categoría:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAdminCategories, createCategory, updateCategory, deleteCategory };