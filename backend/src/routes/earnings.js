const express = require('express');
const router = express.Router();
const { adminAuth, requirePermission } = require('../middleware/auth');
const { getEarnings } = require('../controllers/earningsController');

router.get('/admin/earnings', adminAuth, requirePermission('products.view'), getEarnings);

module.exports = router;
