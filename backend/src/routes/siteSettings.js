const express = require('express');
const router = express.Router();
const { getSiteSettings } = require('../controllers/siteSettingsController');

router.get('/site-settings', getSiteSettings);

module.exports = router;