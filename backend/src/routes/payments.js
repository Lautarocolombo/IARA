const express = require('express');
const router = express.Router();
const { confirmTransferPayment, getPaymentStatus } = require('../controllers/paymentController');

router.post('/payments/transfer', confirmTransferPayment);
router.get('/payments/transfer/status', getPaymentStatus);

module.exports = router;