const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const { reviewSchema } = require('../lib/validators');
const logger = require('../lib/logger');

const getProductReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const result = await query(
      'SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    );
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
    const result = await query(
      'INSERT INTO reviews (product_id, rating, comment) VALUES ($1, $2, $3) RETURNING *',
      [productId, Number(data.rating), data.comment]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
    }
    logger.error('Error creando reseña:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getProductReviews, createReview };