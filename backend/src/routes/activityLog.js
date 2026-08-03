const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getActivityLog, getEntityActivity } = require('../controllers/activityLogController');

router.get('/admin/activity-log', adminAuth, getActivityLog);
router.get('/admin/activity', adminAuth, getEntityActivity);

module.exports = router;
