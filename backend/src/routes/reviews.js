const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getProductReviews, createReview } = require('../controllers/reviewsController');

router.get('/products/:productId/reviews', getProductReviews);
router.post('/products/:productId/reviews', adminAuth, createReview);

module.exports = router;