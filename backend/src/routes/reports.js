const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getSalesReport, getSalesTrend, resetMetrics, getWeeklySummary, getSalesSummary } = require('../controllers/reportsController');

router.get('/admin/reports/sales', adminAuth, adminOnly, getSalesReport);
router.get('/admin/reports/trend', adminAuth, adminOnly, getSalesTrend);
router.get('/admin/reports/weekly-summary', adminAuth, adminOnly, getWeeklySummary);
router.get('/admin/reports/summary', adminAuth, adminOnly, getSalesSummary);
router.post('/admin/reports/reset', adminAuth, adminOnly, resetMetrics);

module.exports = router;
