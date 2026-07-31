const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getPublicProducts, getPublicProductById, getAdminProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productsController');

router.get('/products', getPublicProducts);
router.get('/products/:id', getPublicProductById);
router.get('/admin/products', adminAuth, getAdminProducts);
router.post('/admin/products', adminAuth, createProduct);
router.put('/admin/products/:id', adminAuth, updateProduct);
router.delete('/admin/products/:id', adminAuth, deleteProduct);

module.exports = router;
