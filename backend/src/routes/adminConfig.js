const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getAdminPaymentConfig, updateAdminPaymentConfig } = require('../controllers/configController');

router.get('/admin/payment-config', adminAuth, adminOnly, getAdminPaymentConfig);
router.put('/admin/payment-config', adminAuth, adminOnly, updateAdminPaymentConfig);

module.exports = router;