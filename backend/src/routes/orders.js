const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getOrders, createOrder, updateOrderStatus } = require('../controllers/ordersController');

router.get('/admin/orders', adminAuth, getOrders);
router.post('/orders', createOrder);
router.put('/admin/orders/:id', adminAuth, updateOrderStatus);

module.exports = router;
