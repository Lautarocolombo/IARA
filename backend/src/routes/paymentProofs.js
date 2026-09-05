const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
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

router.get('/admin/payment-proofs', adminAuth, adminOnly, getAdminPaymentProofs);
router.get('/admin/payment-stats', adminAuth, adminOnly, getPaymentStats);
router.get('/admin/activity-log', adminAuth, adminOnly, getAdminActivityLog);
router.post('/admin/payment-proofs/:id/approve', adminAuth, adminOnly, approvePaymentProof);
router.post('/admin/payment-proofs/:id/reject', adminAuth, adminOnly, rejectPaymentProof);

router.post('/payments/proofs/:orderId', requireOrderToken, uploadSingleProof, handleUploadError, uploadPaymentProof);

module.exports = router;
