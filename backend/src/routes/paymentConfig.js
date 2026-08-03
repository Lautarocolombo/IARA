const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getAdminPaymentConfig, updateAdminPaymentConfig, getPublicPaymentConfig } = require('../controllers/siteSettingsController');

router.get('/payment-config', getPublicPaymentConfig);
router.get('/admin/payment-config', adminAuth, getAdminPaymentConfig);
router.put('/admin/payment-config', adminAuth, updateAdminPaymentConfig);

module.exports = router;
