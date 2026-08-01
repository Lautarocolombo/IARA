const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getOrders, createOrder, updateOrderStatus, getUserOrders, deleteOrder } = require('../controllers/ordersController');

router.get('/admin/orders', adminAuth, getOrders);
router.get('/orders', getUserOrders);
router.post('/orders', createOrder);
router.put('/admin/orders/:id', adminAuth, updateOrderStatus);
router.delete('/admin/orders/:id', adminAuth, deleteOrder);

module.exports = router;
