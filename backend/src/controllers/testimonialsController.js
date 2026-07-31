const { query } = require('../lib/db');

const getPublicTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials WHERE active = TRUE ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo testimonios:', err);
    res.status(500).json({ error: err.message });
  }
};

const getAdminTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo testimonios (admin):', err);
    res.status(500).json({ error: err.message });
  }
};

const createTestimonial = async (req, res) => {
  const { name, comment, rating = 5, image = '', active = true } = req.body || {};
  if (!name || !comment) return res.status(400).json({ error: 'Nombre y comentario son requeridos' });
  try {
    const result = await query(
      'INSERT INTO testimonials (name, comment, rating, image, avatar, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, comment, Number(rating), image, image, active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando testimonio:', err);
    res.status(500).json({ error: err.message });
  }
};

const updateTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    if (f === 'image') {
      setParts.push(`avatar = $${i + 1}`);
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
    console.error('Error actualizando testimonio:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando testimonio:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPublicTestimonials, getAdminTestimonials, createTestimonial, updateTestimonial, deleteTestimonial };
