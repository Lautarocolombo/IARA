const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const {
  getSiteSettings,
  updateSiteSettings,
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getPublicPaymentConfig
} = require('../controllers/siteSettingsController');

router.get('/site-settings', getSiteSettings);
router.get('/payment-config', getPublicPaymentConfig);

router.get('/admin/settings', adminAuth, getSiteSettings);
router.put('/admin/settings', adminAuth, updateSiteSettings);
router.get('/admin/payment-config', adminAuth, getAdminPaymentConfig);
router.put('/admin/payment-config', adminAuth, updateAdminPaymentConfig);

module.exports = router;
