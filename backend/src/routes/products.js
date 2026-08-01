const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getPublicProducts, getAdminProducts, createProduct, updateProduct, deleteProduct, searchProducts, syncToNeon } = require('../controllers/productsController');

router.get('/products', getPublicProducts);
router.get('/products/search', searchProducts);
router.get('/admin/products', adminAuth, getAdminProducts);
router.post('/admin/products', adminAuth, createProduct);
router.put('/admin/products/:id', adminAuth, updateProduct);
router.delete('/admin/products/:id', adminAuth, deleteProduct);
router.post('/admin/sync-to-neon', adminAuth, syncToNeon);

module.exports = router;
