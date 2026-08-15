const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getSales, createManualSale } = require('../controllers/salesController');

router.get('/admin/sales', adminAuth, adminOnly, getSales);
router.post('/admin/sales', adminAuth, adminOnly, createManualSale);

module.exports = router;
