const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getHeroCards, upsertHeroCard, syncHeroCards } = require('../controllers/heroCardsController');

router.get('/admin/hero-cards', adminAuth, getHeroCards);
router.post('/admin/hero-cards', adminAuth, upsertHeroCard);
router.put('/admin/hero-cards/:id', adminAuth, upsertHeroCard);
router.post('/admin/hero-cards/sync', adminAuth, syncHeroCards);

module.exports = router;
