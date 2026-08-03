const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { handleUploadError, uploadSingle } = require('../lib/upload');
const { getCategories, getPublicCategories, createCategory, updateCategory, deleteCategory, updateCategoryOrder } = require('../controllers/categoriesController');

router.get('/categories', getPublicCategories);
router.get('/admin/categories', adminAuth, getCategories);
router.post('/admin/categories', adminAuth, uploadSingle, handleUploadError, createCategory);
router.put('/admin/categories/:id', adminAuth, uploadSingle, handleUploadError, updateCategory);
router.patch('/admin/categories/order', adminAuth, updateCategoryOrder);
router.delete('/admin/categories/:id', adminAuth, deleteCategory);

module.exports = router;
