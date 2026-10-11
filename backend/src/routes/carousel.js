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

// Cache-Control para GET públicos de contenido: 60s cache, 5min stale-while-revalidate
const publicCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
};

router.get('/carousel/public', publicCache, getCarouselSlotsPublic);
router.get('/carousel', adminAuth, getCarouselSlots);
router.put('/carousel/:slot', adminAuth, uploadSingle, handleUploadError, updateCarouselSlot);
router.put('/carousel/:slot/meta', adminAuth, updateCarouselSlotMeta);
router.delete('/carousel/:slot', adminAuth, deleteCarouselSlot);

module.exports = router;
