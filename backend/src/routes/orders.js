const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getOrders, createOrder, updateOrderStatus, getUserOrders, deleteOrder, updateOrderNotes, getOrderDetail } = require('../controllers/ordersController');

router.get('/admin/orders', adminAuth, getOrders);
router.get('/orders', adminAuth, getUserOrders);
router.post('/orders', createOrder);
router.put('/admin/orders/:id', adminAuth, updateOrderStatus);
router.put('/admin/orders/:id/notes', adminAuth, updateOrderNotes);
router.get('/admin/orders/:id', adminAuth, getOrderDetail);
router.delete('/admin/orders/:id', adminAuth, deleteOrder);

module.exports = router;
