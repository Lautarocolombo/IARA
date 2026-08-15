const express = require('express');
const router = express.Router();
const { getShippingDiff, getShippingRates, updateShippingRates } = require('../controllers/shippingController');
const { adminAuth, adminOnly } = require('../middleware/auth');

router.get('/shipping-diff', getShippingDiff);

router.get('/admin/shipping-rates', adminAuth, adminOnly, getShippingRates);

router.put('/admin/shipping-rates', adminAuth, adminOnly, updateShippingRates);

module.exports = router;
