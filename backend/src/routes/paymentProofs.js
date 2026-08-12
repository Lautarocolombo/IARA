const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const {
  getAdminPaymentProofs,
  uploadPaymentProof,
  approvePaymentProof,
  rejectPaymentProof,
  getPaymentStats,
  getAdminActivityLog
} = require('../controllers/paymentProofsController');
const { uploadSingleProof, handleUploadError } = require('../lib/upload');
const { requireOrderToken } = require('../middleware/requireOrderToken');

router.get('/admin/payment-proofs', adminAuth, getAdminPaymentProofs);
router.get('/admin/payment-stats', adminAuth, getPaymentStats);
router.get('/admin/activity-log', adminAuth, getAdminActivityLog);
router.post('/admin/payment-proofs/:id/approve', adminAuth, approvePaymentProof);
router.post('/admin/payment-proofs/:id/reject', adminAuth, rejectPaymentProof);

router.post('/payments/proofs/:orderId', requireOrderToken, handleUploadError, uploadSingleProof, uploadPaymentProof);

module.exports = router;
