const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSalesSummary, getInventoryMovements } = require('../controllers/reportsController');

router.get('/admin/reports/sales', adminAuth, getSalesSummary);
router.get('/admin/reports/inventory-movements', adminAuth, getInventoryMovements);

module.exports = router;
