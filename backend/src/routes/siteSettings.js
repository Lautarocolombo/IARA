const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSiteSettings, updateSiteSettings } = require('../controllers/siteSettingsController');

router.get('/site-settings', getSiteSettings);
router.get('/admin/settings', adminAuth, getSiteSettings);
router.put('/admin/settings', adminAuth, updateSiteSettings);

module.exports = router;