const express = require('express');
const router = express.Router();
const {
  getCarouselSlots,
  updateCarouselSlot,
  deleteCarouselSlot
} = require('../controllers/carouselController');
const { adminAuth } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../lib/upload');

router.get('/carousel', getCarouselSlots);
router.put('/carousel/:slot', adminAuth, uploadSingle, handleUploadError, updateCarouselSlot);
router.delete('/carousel/:slot', adminAuth, deleteCarouselSlot);

module.exports = router;
