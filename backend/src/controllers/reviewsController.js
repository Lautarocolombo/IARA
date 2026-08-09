const { query } = require('../lib/db');
const { reviewSchema } = require('../lib/validators');
const logger = require('../lib/logger');
const { saveUploadedFile } = require('../lib/upload');
const { syncBus } = require('../routes/sync');

const getProductReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const result = await query(
      'SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo reseñas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createReview = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const data = reviewSchema.parse(req.body);
    let avatar = '';
    if (req.file) {
      try {
        avatar = await saveUploadedFile(req.file);
      } catch (uploadErr) {
        logger.warn({ err: uploadErr.message }, 'Error guardando avatar de reseña');
      }
    }
    const result = await query(
      'INSERT INTO reviews (product_id, rating, comment, name, avatar) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [productId, Number(data.rating), data.comment, data.name || '', avatar]
    );
    res.status(201).json(result.rows[0]);
    try { syncBus.emit('reviews_updated', { productId }); } catch (e) { /* noop */ }
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
    }
    logger.error('Error creando reseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getProductReviews, createReview };