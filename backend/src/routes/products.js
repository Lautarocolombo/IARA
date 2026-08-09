const express = require('express');
const router = express.Router();
const { adminAuth, requirePermission } = require('../middleware/auth');
const { getPublicProducts, getProductById, getAdminProducts, createProduct, updateProduct, deleteProduct, searchProducts, syncToNeon, bulkImportProducts, toggleProductStatus, duplicateProduct } = require('../controllers/productsController');
const { handleUploadError, uploadSingle, uploadMultiple } = require('../lib/upload');

router.get('/products', getPublicProducts);
router.get('/products/search', searchProducts);
router.get('/products/:id', getProductById);
router.get('/admin/products', adminAuth, requirePermission('products.view'), getAdminProducts);
router.post('/admin/products', adminAuth, requirePermission('products.create'), uploadMultiple, handleUploadError, createProduct);
router.put('/admin/products/:id', adminAuth, requirePermission('products.edit'), uploadMultiple, handleUploadError, updateProduct);
router.patch('/admin/products/:id/estado', adminAuth, requirePermission('products.edit'), toggleProductStatus);
router.post('/admin/products/:id/duplicar', adminAuth, requirePermission('products.create'), duplicateProduct);
router.delete('/admin/products/:id', adminAuth, requirePermission('products.delete'), deleteProduct);
router.post('/admin/sync-to-neon', adminAuth, requirePermission('products.edit'), syncToNeon);
router.post('/admin/products/bulk-import', adminAuth, requirePermission('products.create'), uploadSingle, handleUploadError, bulkImportProducts);

module.exports = router;
