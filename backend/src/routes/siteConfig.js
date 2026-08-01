const express = require('express');
const router = express.Router();
const { getSiteConfig, updatePaymentConfig } = require('../controllers/siteConfigController');

router.get('/site-config', getSiteConfig);
router.put('/admin/payment-config', require('../middleware/auth').adminAuth, updatePaymentConfig);

module.exports = router;