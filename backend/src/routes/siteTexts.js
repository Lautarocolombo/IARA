const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSiteTexts, upsertSiteText, syncTextsToNeon } = require('../controllers/siteTextsController');

router.get('/site-texts', getSiteTexts);
router.get('/admin/site-texts', adminAuth, getSiteTexts);
router.post('/admin/site-texts', adminAuth, upsertSiteText);
router.put('/admin/site-texts', adminAuth, upsertSiteText);
router.put('/admin/site-texts/:key', adminAuth, upsertSiteText);
router.post('/admin/sync-texts', adminAuth, syncTextsToNeon);

module.exports = router;
