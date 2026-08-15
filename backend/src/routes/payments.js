const express = require('express');
const router = express.Router();
const { confirmTransferPayment, getPaymentStatus, getPaymentReconciliation } = require('../controllers/paymentController');
const { adminAuth } = require('../middleware/auth');
const { requireOrderToken } = require('../middleware/requireOrderToken');

router.post('/payments/transfer', requireOrderToken, confirmTransferPayment);
router.get('/payments/transfer/status', getPaymentStatus);
router.get('/admin/payments/reconciliation', adminAuth, getPaymentReconciliation);

module.exports = router;
