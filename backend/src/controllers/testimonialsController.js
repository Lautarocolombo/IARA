const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { getPublicUrl } = require('../lib/upload');

const ALLOWED_TESTIMONIAL_COLUMNS = ['name', 'comment', 'rating', 'image', 'avatar', 'active', 'orden'];

const getPublicTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials WHERE active = TRUE ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo testimonios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials ORDER BY orden ASC, created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo testimonios (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createTestimonial = async (req, res) => {
  let { name, comment, rating = 5, image = '', active = true, orden = 0 } = req.body || {};
  if (req.file) {
    image = getPublicUrl(`/uploads/products/${req.file.filename}`);
  }
  if (!name || !comment) return res.status(400).json({ error: 'Nombre y comentario son requeridos' });
  try {
    const result = await query(
      'INSERT INTO testimonials (name, comment, rating, image, avatar, active, orden) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, comment, Number(rating), image, image, active !== false, Number(orden)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toggleTestimonialActive = async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  try {
    const result = await query(
      'UPDATE testimonials SET active = $1 WHERE id = $2 RETURNING *',
      [active !== false, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando estado del testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateTestimonialOrder = async (req, res) => {
  const { orden } = req.body || {};
  if (!Array.isArray(orden)) return res.status(400).json({ error: 'Se requiere un array de órdenes' });
  try {
    for (const item of orden) {
      if (item.id !== undefined && item.orden !== undefined) {
        await query('UPDATE testimonials SET orden = $1 WHERE id = $2', [Number(item.orden), Number(item.id)]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error actualizando orden de testimonios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  if (req.file) {
    updates.image = getPublicUrl(`/uploads/products/${req.file.filename}`);
  }
  const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED_TESTIMONIAL_COLUMNS.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    if (f === 'image') {
      setParts.push(`image = $${i + 1}`, `avatar = $${i + 1}`);
      values.push(updates[f]);
    } else {
      setParts.push(`${f} = $${i + 1}`);
      values.push(f === 'rating' ? Number(updates[f]) : updates[f]);
    }
  });
  values.push(id);
  try {
    const result = await query(`UPDATE testimonials SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getPublicTestimonials, getAdminTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, toggleTestimonialActive, updateTestimonialOrder };
