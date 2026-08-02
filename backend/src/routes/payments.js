const express = require('express');
const router = express.Router();
const { confirmTransferPayment, getPaymentStatus } = require('../controllers/paymentController');

router.post('/transfer', confirmTransferPayment);
router.get('/transfer/status', getPaymentStatus);

module.exports = router;