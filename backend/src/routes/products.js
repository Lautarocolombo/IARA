const express = require('express');
const router = express.Router();
const { adminAuth, requirePermission } = require('../middleware/auth');
const { getPublicProducts, getAdminProducts, createProduct, updateProduct, deleteProduct, searchProducts, syncToNeon, bulkImportProducts } = require('../controllers/productsController');
const { handleUploadError, uploadSingle, uploadMultiple } = require('../lib/upload');

router.get('/products', getPublicProducts);
router.get('/products/search', searchProducts);
router.get('/admin/products', adminAuth, requirePermission('products.view'), getAdminProducts);
router.post('/admin/products', adminAuth, requirePermission('products.create'), createProduct);
router.put('/admin/products/:id', adminAuth, requirePermission('products.edit'), updateProduct);
router.delete('/admin/products/:id', adminAuth, requirePermission('products.delete'), deleteProduct);
router.post('/admin/sync-to-neon', adminAuth, requirePermission('products.edit'), syncToNeon);
router.post('/admin/products/bulk-import', adminAuth, requirePermission('products.create'), uploadSingle, handleUploadError, bulkImportProducts);

module.exports = router;
