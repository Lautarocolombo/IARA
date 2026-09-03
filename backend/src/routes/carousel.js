const express = require('express');
const router = express.Router();
const {
  getCarouselSlots,
  getCarouselSlotsPublic,
  updateCarouselSlot,
  updateCarouselSlotMeta,
  deleteCarouselSlot
} = require('../controllers/carouselController');
const { adminAuth } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../lib/upload');

router.get('/carousel/public', getCarouselSlotsPublic);
router.get('/carousel', adminAuth, getCarouselSlots);
router.put('/carousel/:slot', adminAuth, uploadSingle, handleUploadError, updateCarouselSlot);
router.put('/carousel/:slot/meta', adminAuth, updateCarouselSlotMeta);
router.delete('/carousel/:slot', adminAuth, deleteCarouselSlot);

module.exports = router;
