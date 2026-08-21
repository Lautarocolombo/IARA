const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getEarnings } = require('../controllers/earningsController');
const { clearHistory } = require('../controllers/historyController');

router.get('/admin/earnings', adminAuth, adminOnly, getEarnings);
router.delete('/admin/earnings/history', adminAuth, adminOnly, clearHistory);

module.exports = router;