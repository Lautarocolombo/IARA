const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { handleUploadError, uploadSingle } = require('../lib/upload');
const { getOrders, createOrder, updateOrderStatus, getUserOrders, deleteOrder, deleteMultipleOrders, updateOrderNotes, getOrderDetail, exportOrders } = require('../controllers/ordersController');
const { uploadReceipt } = require('../controllers/receiptsController');

router.get('/admin/orders', adminAuth, getOrders);
router.get('/admin/orders/export', adminAuth, exportOrders);
router.get('/orders', getUserOrders);
router.post('/orders', createOrder);
router.post('/orders/:id/receipt', uploadSingle, handleUploadError, uploadReceipt);
router.patch('/admin/orders/:id/status', adminAuth, updateOrderStatus);
router.put('/admin/orders/:id/notes', adminAuth, updateOrderNotes);
router.get('/admin/orders/:id', adminAuth, getOrderDetail);
router.delete('/admin/orders/:id', adminAuth, deleteOrder);
router.delete('/admin/orders/bulk', adminAuth, deleteMultipleOrders);

module.exports = router;
