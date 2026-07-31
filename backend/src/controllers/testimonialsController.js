const { query } = require('../lib/db');
const { z } = require('zod');

const ALLOWED_TESTIMONIAL_FIELDS = ['name', 'comment', 'rating', 'image', 'active'];

const createTestimonialSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100),
  comment: z.string().min(1, 'Comentario es requerido').max(1000),
  rating: z.number().int().min(1).max(5).default(5),
  image: z.string().optional().default(''),
  active: z.boolean().default(true)
});

const getPublicTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT id, name, comment, rating, image, active, created_at FROM testimonials WHERE active = TRUE ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo testimonios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminTestimonials = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataResult = await query('SELECT id, name, comment, rating, image, active, created_at FROM testimonials ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await query('SELECT COUNT(*) AS total FROM testimonials');
    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: dataResult.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    console.error('Error obteniendo testimonios (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createTestimonial = async (req, res) => {
  try {
    const parsed = createTestimonialSchema.safeParse(req.body);
    if (!parsed.success) {
      const { error } = parsed;
      const message = (error && error.issues && error.issues[0] && error.issues[0].message) ? error.issues[0].message : (error && error.errors && error.errors[0]) ? error.errors[0] : 'Datos inválidos';
      return res.status(400).json({ error: message });
    }
    const { name, comment, rating, image, active } = parsed.data;
    const result = await query(
      'INSERT INTO testimonials (name, comment, rating, image, active) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, comment, rating, image, active, created_at',
      [name, comment, Number(rating), image, active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  const fields = Object.keys(updates).filter(k => ALLOWED_TESTIMONIAL_FIELDS.includes(k) && k !== 'id');
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => (f === 'rating' ? Number(updates[f]) : updates[f]));
  values.push(id);
  try {
    const result = await query(`UPDATE testimonials SET ${setClause} WHERE id = $${values.length} RETURNING id, name, comment, rating, image, active, created_at`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando testimonio:', err);
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
    console.error('Error eliminando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getPublicTestimonials, getAdminTestimonials, createTestimonial, updateTestimonial, deleteTestimonial };
