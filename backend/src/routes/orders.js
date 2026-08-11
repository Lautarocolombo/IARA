const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getOrders, createOrder, updateOrderStatus, getUserOrders, deleteOrder, updateOrderNotes, getOrderDetail, exportOrders, addOrderActivity, getOrderReceipt, getOrderActivities, getPublicOrderTrack } = require('../controllers/ordersController');
const { uploadPaymentProof } = require('../controllers/paymentProofsController');
const { uploadSingleProof, handleUploadError } = require('../lib/upload');

router.get('/admin/orders', adminAuth, getOrders);
router.get('/admin/orders/export', adminAuth, exportOrders);
router.get('/admin/orders/:id/receipt', adminAuth, getOrderReceipt);
router.post('/admin/orders/:id/receipt', adminAuth, uploadSingleProof, handleUploadError, uploadPaymentProof);
router.get('/orders', getUserOrders);
router.get('/orders/:id/track', getPublicOrderTrack);
router.post('/orders', createOrder);
router.patch('/admin/orders/:id/status', adminAuth, updateOrderStatus);
router.put('/admin/orders/:id/notes', adminAuth, updateOrderNotes);
router.post('/admin/orders/:id/activity', adminAuth, addOrderActivity);
router.get('/admin/orders/:id/activity', adminAuth, getOrderActivities);
// router.delete('/admin/orders/bulk', adminAuth, deleteMultipleOrders);
router.get('/admin/orders/:id', adminAuth, getOrderDetail);
router.delete('/admin/orders/:id', adminAuth, deleteOrder);

module.exports = router;
