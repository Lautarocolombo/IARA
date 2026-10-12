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

// Cache-Control para GET públicos de contenido: 60s cache, 5min stale-while-revalidate
const publicCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
};

router.get('/site-settings', publicCache, getSiteSettings);
router.get('/payment-config', publicCache, getPublicPaymentConfig);

router.get('/admin/settings', adminAuth, adminOnly, getSiteSettings);
router.put('/admin/settings', adminAuth, adminOnly, updateSiteSettings);
router.get('/admin/payment-config', adminAuth, adminOnly, getAdminPaymentConfig);
router.put('/admin/payment-config', adminAuth, adminOnly, updateAdminPaymentConfig);

module.exports = router;
