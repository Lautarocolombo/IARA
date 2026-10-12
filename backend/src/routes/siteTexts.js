const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSiteTexts, upsertSiteText, syncTextsToNeon } = require('../controllers/siteTextsController');

// Cache-Control para GET públicos de contenido: 60s cache, 5min stale-while-revalidate
const publicCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
};

router.get('/site-texts', publicCache, getSiteTexts);
router.get('/admin/site-texts', adminAuth, getSiteTexts);
router.post('/admin/site-texts', adminAuth, upsertSiteText);
router.put('/admin/site-texts', adminAuth, upsertSiteText);
router.put('/admin/site-texts/:key', adminAuth, upsertSiteText);
router.post('/admin/sync-texts', adminAuth, syncTextsToNeon);

module.exports = router;
