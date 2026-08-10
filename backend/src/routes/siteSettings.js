const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const {
  getSiteSettings,
  updateSiteSettings,
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getPublicPaymentConfig,
  getShippingZones,
  calculateShippingCost,
  getAdminShippingZones,
  updateAdminShippingZones
} = require('../controllers/siteSettingsController');

router.get('/site-settings', getSiteSettings);
router.get('/payment-config', getPublicPaymentConfig);
router.get('/shipping-zones', getShippingZones);
router.get('/api/shipping/calculate', calculateShippingCost);

router.get('/admin/settings', adminAuth, getSiteSettings);
router.put('/admin/settings', adminAuth, updateSiteSettings);
router.get('/admin/payment-config', adminAuth, getAdminPaymentConfig);
router.put('/admin/payment-config', adminAuth, updateAdminPaymentConfig);
router.get('/admin/shipping/zones', adminAuth, getAdminShippingZones);
router.put('/admin/shipping/zones', adminAuth, updateAdminShippingZones);

module.exports = router;
