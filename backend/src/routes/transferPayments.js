const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { listTransferPayments, verifyTransferPayment, rejectTransferPayment, getExpiredOrders, refundStockForOrder } = require('../controllers/transferPaymentsController');

router.get('/admin/transfer-payments', adminAuth, listTransferPayments);
router.post('/admin/transfer-payments/:receiptId/verify', adminAuth, verifyTransferPayment);
router.post('/admin/transfer-payments/:receiptId/reject', adminAuth, rejectTransferPayment);
router.get('/admin/orders/expired', adminAuth, getExpiredOrders);
router.post('/admin/orders/:id/refund-stock', adminAuth, refundStockForOrder);

module.exports = router;
