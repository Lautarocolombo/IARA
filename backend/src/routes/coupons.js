const express = require('express');
const router = express.Router();
const { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon } = require('../controllers/couponsController');
const { adminAuth, adminOnly } = require('../middleware/auth');

router.get('/coupons', adminAuth, adminOnly, getCoupons);
router.post('/coupons', adminAuth, adminOnly, createCoupon);
router.put('/coupons/:id', adminAuth, adminOnly, updateCoupon);
router.delete('/coupons/:id', adminAuth, adminOnly, deleteCoupon);
router.post('/coupons/validate', validateCoupon);

module.exports = router;