const express = require('express');
const router = express.Router();
const {
  getProductImages,
  uploadProductImages,
  updateProductImage,
  deleteProductImage,
  replaceProductImage,
  syncProductImages
} = require('../controllers/productImagesController');
const { adminAuth } = require('../middleware/auth');
const { uploadMultiple, uploadSingle, handleUploadError } = require('../lib/upload');

router.get('/products/:id/images', getProductImages);
router.post('/products/:id/images', adminAuth, uploadMultiple, handleUploadError, uploadProductImages);
router.patch('/products/:id/images/:imageId', adminAuth, updateProductImage);
router.put('/products/:id/images/:imageId/replace', adminAuth, uploadSingle, handleUploadError, replaceProductImage);
router.delete('/products/:id/images/:imageId', adminAuth, deleteProductImage);
router.post('/products/:id/images/sync-order', adminAuth, syncProductImages);

module.exports = router;
