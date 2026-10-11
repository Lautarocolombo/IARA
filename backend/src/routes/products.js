const express = require('express');
const router = express.Router();
const { adminAuth, requirePermission } = require('../middleware/auth');
const { getPublicProducts, getProductById, getAdminProducts, createProduct, updateProduct, deleteProduct, searchProducts, syncToNeon, bulkImportProducts, toggleProductStatus, duplicateProduct, bulkDeleteProducts, bulkToggleProducts, getFeaturedProducts, quickUpdateProduct } = require('../controllers/productsController');
const { handleUploadError, uploadSingle, uploadMultiple } = require('../lib/upload');

// Cache-Control para GET públicos de contenido: 60s cache, 5min stale-while-revalidate
const publicCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
};

router.get('/products', publicCache, getPublicProducts);
router.get('/products/featured', publicCache, getFeaturedProducts);
router.get('/products/search', searchProducts);
router.get('/products/:id', publicCache, getProductById);
router.get('/admin/products', adminAuth, requirePermission('products:read'), getAdminProducts);
router.post('/admin/products', adminAuth, requirePermission('products:write'), uploadMultiple, handleUploadError, createProduct);
router.put('/admin/products/:id', adminAuth, requirePermission('products:write'), uploadMultiple, handleUploadError, updateProduct);
router.patch('/admin/products/:id/estado', adminAuth, requirePermission('products:write'), toggleProductStatus);
router.post('/admin/products/:id/duplicar', adminAuth, requirePermission('products:write'), duplicateProduct);
router.patch('/admin/products/:id/quick-update', adminAuth, requirePermission('products:write'), quickUpdateProduct);
router.delete('/admin/products/:id', adminAuth, requirePermission('products:delete'), deleteProduct);
router.post('/admin/products/bulk-delete', adminAuth, requirePermission('products:delete'), bulkDeleteProducts);
router.post('/admin/products/bulk-toggle', adminAuth, requirePermission('products:write'), bulkToggleProducts);
router.post('/admin/sync-to-neon', adminAuth, requirePermission('products:write'), syncToNeon);
router.post('/admin/products/bulk-import', adminAuth, requirePermission('products:write'), uploadSingle, handleUploadError, bulkImportProducts);

module.exports = router;
