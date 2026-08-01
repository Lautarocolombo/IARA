const express = require('express');
const router = express.Router();
const { getSiteConfig, updateMpAlias } = require('../controllers/siteConfigController');

router.get('/site-config', getSiteConfig);
router.put('/admin/payment-config', require('../middleware/auth').adminAuth, updateMpAlias);

module.exports = router;