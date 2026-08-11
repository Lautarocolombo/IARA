const express = require('express');
const router = express.Router();
const { adminAuth, requirePermission } = require('../middleware/auth');
const { getSales, createManualSale } = require('../controllers/salesController');

router.get('/admin/sales', adminAuth, requirePermission('products.view'), getSales);
router.post('/admin/sales', adminAuth, requirePermission('products.create'), createManualSale);

module.exports = router;
