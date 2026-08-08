const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSalesReport, getSalesTrend, resetMetrics, getWeeklySummary } = require('../controllers/reportsController');

router.get('/admin/reports/sales', adminAuth, getSalesReport);
router.get('/admin/reports/trend', adminAuth, getSalesTrend);
router.get('/admin/reports/weekly-summary', adminAuth, getWeeklySummary);
router.post('/admin/reports/reset', adminAuth, resetMetrics);

module.exports = router;
