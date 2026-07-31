const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { addProductImage, listProductImages, deleteProductImage, setPrimaryImage } = require('../controllers/productImagesController');
const { uploadSingle, handleUploadError } = require('../lib/upload');

router.post('/:productId/images', adminAuth, uploadSingle, handleUploadError, addProductImage);
router.get('/:productId/images', adminAuth, listProductImages);
router.delete('/:productId/images/:imageId', adminAuth, deleteProductImage);
router.put('/:productId/images/:imageId/primary', adminAuth, setPrimaryImage);

module.exports = router;
