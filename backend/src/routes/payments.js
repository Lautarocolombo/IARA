const express = require('express');
const router = express.Router();
const { confirmTransferPayment, getPaymentStatus } = require('../controllers/paymentController');
const { requireOrderToken } = require('../middleware/requireOrderToken');

router.post('/payments/transfer', requireOrderToken, confirmTransferPayment);
router.get('/payments/transfer/status', getPaymentStatus);

module.exports = router;
