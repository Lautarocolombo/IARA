const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { uploadSingle, uploadTestimonialFields, handleUploadError } = require('../lib/upload');
const {
  getPublicTestimonials,
  getAdminTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialActive,
  updateTestimonialOrder,
  reorderTestimonials,
  uploadTestimonialImage,
  deleteTestimonialImage,
  uploadTestimonialProductImage,
  deleteTestimonialProductImage
} = require('../controllers/testimonialsController');

router.get('/testimonials', getPublicTestimonials);
router.get('/admin/testimonials', adminAuth, getAdminTestimonials);
router.post('/admin/testimonials', adminAuth, uploadTestimonialFields, handleUploadError, createTestimonial);
router.put('/admin/testimonials/:id', adminAuth, uploadTestimonialFields, handleUploadError, updateTestimonial);
router.patch('/admin/testimonials/:id/active', adminAuth, toggleTestimonialActive);
router.patch('/admin/testimonials/:id/order', adminAuth, updateTestimonialOrder);
router.patch('/admin/testimonials/reorder', adminAuth, reorderTestimonials);
router.delete('/admin/testimonials/:id', adminAuth, deleteTestimonial);
router.post('/admin/testimonials/:id/image', adminAuth, uploadSingle, handleUploadError, uploadTestimonialImage);
router.delete('/admin/testimonials/:id/image', adminAuth, deleteTestimonialImage);
router.post('/admin/testimonials/:id/product-image', adminAuth, uploadSingle, handleUploadError, uploadTestimonialProductImage);
router.delete('/admin/testimonials/:id/product-image', adminAuth, deleteTestimonialProductImage);

module.exports = router;