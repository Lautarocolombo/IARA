const express = require('express');
const router = express.Router();
const {
  getProductImages,
  uploadProductImages,
  updateProductImage,
  deleteProductImage,
  syncProductImages
} = require('../controllers/productImagesController');
const { adminAuth } = require('../middleware/auth');
const { uploadMultiple, handleUploadError } = require('../lib/upload');

router.get('/products/:id/images', getProductImages);
router.post('/products/:id/images', adminAuth, uploadMultiple, handleUploadError, uploadProductImages);
router.patch('/products/:id/images/:imageId', adminAuth, updateProductImage);
router.delete('/products/:id/images/:imageId', adminAuth, deleteProductImage);
router.post('/products/:id/images/sync-order', adminAuth, syncProductImages);

module.exports = router;
