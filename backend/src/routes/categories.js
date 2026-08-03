const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoriesController');

router.get('/admin/categories', adminAuth, getCategories);
router.post('/admin/categories', adminAuth, createCategory);
router.put('/admin/categories/:id', adminAuth, updateCategory);
router.delete('/admin/categories/:id', adminAuth, deleteCategory);

module.exports = router;
