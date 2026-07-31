const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getPublicTestimonials, getAdminTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } = require('../controllers/testimonialsController');

router.get('/testimonials', getPublicTestimonials);
router.get('/admin/testimonials', adminAuth, getAdminTestimonials);
router.post('/admin/testimonials', adminAuth, createTestimonial);
router.put('/admin/testimonials/:id', adminAuth, updateTestimonial);
router.delete('/admin/testimonials/:id', adminAuth, deleteTestimonial);

module.exports = router;
