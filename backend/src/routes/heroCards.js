const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { handleUploadError, uploadSingle } = require('../lib/upload');
const {
  getHeroCards,
  getPublicHeroCards,
  getHeroCardBySlot,
  upsertHeroCard,
  updateHeroSlot,
  deleteHeroSlotImage,
  deleteHeroCard,
  syncHeroCards
} = require('../controllers/heroCardsController');

router.get('/hero-cards', getPublicHeroCards);
router.get('/admin/hero-cards', adminAuth, getHeroCards);
router.get('/admin/hero-cards/slot/:slot', adminAuth, getHeroCardBySlot);
router.post('/admin/hero-cards', adminAuth, uploadSingle, handleUploadError, upsertHeroCard);
router.put('/admin/hero-cards/:id', adminAuth, uploadSingle, handleUploadError, upsertHeroCard);
router.put('/admin/hero-cards/hero/:slot', adminAuth, uploadSingle, handleUploadError, updateHeroSlot);
router.delete('/admin/hero-cards/hero/:slot/imagen', adminAuth, deleteHeroSlotImage);
router.delete('/admin/hero-cards/:id', adminAuth, deleteHeroCard);
router.post('/admin/hero-cards/sync', adminAuth, syncHeroCards);

module.exports = router;
