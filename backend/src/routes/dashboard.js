const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/dashboardController');

router.get('/admin/dashboard/stats', adminAuth, adminOnly, getDashboardStats);

module.exports = router;