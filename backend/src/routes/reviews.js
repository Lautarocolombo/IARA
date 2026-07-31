const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getPublicReviews, createPublicReview, getAdminReviews, updateAdminReview, deleteAdminReview } = require('../controllers/reviewsController');

router.get('/products/:productId/reviews', getPublicReviews);
router.post('/products/:productId/reviews', createPublicReview);
router.get('/admin/reviews', adminAuth, getAdminReviews);
router.put('/admin/reviews/:id', adminAuth, updateAdminReview);
router.delete('/admin/reviews/:id', adminAuth, deleteAdminReview);

module.exports = router;
