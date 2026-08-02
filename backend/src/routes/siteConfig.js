const express = require('express');
const router = express.Router();
const { getSiteConfig } = require('../controllers/siteConfigController');

router.get('/site-config', getSiteConfig);

module.exports = router;