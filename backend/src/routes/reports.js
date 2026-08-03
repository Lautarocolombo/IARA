const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getDashboardStats, getSalesReport } = require('../controllers/reportsController');

router.get('/admin/dashboard', adminAuth, getDashboardStats);
router.get('/admin/reports/sales', adminAuth, getSalesReport);

module.exports = router;
