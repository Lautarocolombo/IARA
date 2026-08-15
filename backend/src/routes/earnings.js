const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getEarnings } = require('../controllers/earningsController');

router.get('/admin/earnings', adminAuth, adminOnly, getEarnings);

module.exports = router;
