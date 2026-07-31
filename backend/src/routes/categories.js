const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getAdminCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoriesController');

router.get('/', adminAuth, getAdminCategories);
router.post('/', adminAuth, createCategory);
router.put('/:id', adminAuth, updateCategory);
router.delete('/:id', adminAuth, deleteCategory);

module.exports = router;