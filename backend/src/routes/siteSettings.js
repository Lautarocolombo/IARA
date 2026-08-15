const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const {
  getSiteSettings,
  updateSiteSettings,
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getPublicPaymentConfig
} = require('../controllers/siteSettingsController');

router.get('/site-settings', getSiteSettings);
router.get('/payment-config', getPublicPaymentConfig);

router.get('/admin/settings', adminAuth, adminOnly, getSiteSettings);
router.put('/admin/settings', adminAuth, adminOnly, updateSiteSettings);
router.get('/admin/payment-config', adminAuth, adminOnly, getAdminPaymentConfig);
router.put('/admin/payment-config', adminAuth, adminOnly, updateAdminPaymentConfig);

module.exports = router;
