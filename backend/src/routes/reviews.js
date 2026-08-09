const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getProductReviews, createReview } = require('../controllers/reviewsController');
const { uploadSingle, handleUploadError } = require('../lib/upload');

const reviewLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas reseñas. Esperá un minuto y volvé a intentar.' }
});

router.get('/products/:productId/reviews', getProductReviews);
router.post('/products/:productId/reviews', reviewLimiter, uploadSingle, handleUploadError, createReview);

module.exports = router;