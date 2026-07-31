const { query } = require('../lib/db');
const { z } = require('zod');

const createReviewSchema = z.object({
  customer_name: z.string().min(1, 'Nombre es requerido').max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().default('')
});

const getPublicReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const result = await query('SELECT id, product_id, customer_name, rating, comment, active, created_at FROM reviews WHERE product_id = $1 AND active = true ORDER BY created_at DESC', [productId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo reseñas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createPublicReview = async (req, res) => {
  try {
    const product_id = Number(req.params.productId);
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      const { error } = parsed;
    const message = (error && error.issues && error.issues[0] && error.issues[0].message) ? error.issues[0].message : (error && error.errors && error.errors[0]) ? error.errors[0] : 'Datos inválidos';
    return res.status(400).json({ error: message });
    }
    const { customer_name, rating, comment } = parsed.data;
    const result = await query('INSERT INTO reviews (product_id, customer_name, rating, comment, active) VALUES ($1, $2, $3, $4, $5) RETURNING *', [product_id, String(customer_name).trim(), Number(rating), String(comment || '').trim(), true]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando reseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminReviews = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dataResult = await query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const countResult = await query('SELECT COUNT(*) AS total FROM reviews');
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
    console.error('Error obteniendo reseñas (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateAdminReview = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { active } = req.body || {};
    const result = await query('UPDATE reviews SET active = $1 WHERE id = $2 RETURNING *', [active !== false, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reseña no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando reseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteAdminReview = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM reviews WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reseña no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando reseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getPublicReviews, createPublicReview, getAdminReviews, updateAdminReview, deleteAdminReview };
