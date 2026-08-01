const express = require('express');
const router = express.Router();
const {
  getAdminPaymentConfig,
  updatePaymentConfig,
  getPublicPaymentConfig
} = require('../controllers/paymentConfigController');

router.get('/payment-config', getPublicPaymentConfig);
router.get('/admin/payment-config', require('../middleware/auth').adminAuth, getAdminPaymentConfig);
router.put('/admin/payment-config', require('../middleware/auth').adminAuth, updatePaymentConfig);

module.exports = router;
