const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getAdminPayments, updatePaymentStatus } = require('../controllers/paymentsController');

router.get('/', adminAuth, getAdminPayments);
router.put('/:id', adminAuth, updatePaymentStatus);

module.exports = router;