const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSiteTexts, upsertSiteText } = require('../controllers/siteTextsController');

router.get('/site-texts', getSiteTexts);
router.get('/admin/site-texts', adminAuth, getSiteTexts);
router.put('/admin/site-texts', adminAuth, upsertSiteText);

module.exports = router;
