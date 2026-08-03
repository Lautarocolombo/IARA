const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSalesReport, getSalesTrend } = require('../controllers/reportsController');

router.get('/admin/reports/sales', adminAuth, getSalesReport);
router.get('/admin/reports/trend', adminAuth, getSalesTrend);

module.exports = router;
