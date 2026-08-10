const express = require('express');
const router = express.Router();
const { confirmTransferPayment, getPaymentStatus } = require('../controllers/paymentController');
const { requireCustomHeader } = require('../middleware/csrf');

router.post('/payments/transfer', requireCustomHeader, confirmTransferPayment);
router.get('/payments/transfer/status', getPaymentStatus);

module.exports = router;
