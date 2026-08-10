const express = require('express');
const router = express.Router();
const { getOrCreateSession, updateCartItems, addCartItem, removeCartItem, clearCart } = require('../controllers/cartController');

router.get('/', getOrCreateSession);
router.post('/items', addCartItem);
router.patch('/items', updateCartItems);
router.delete('/items', removeCartItem);
router.delete('/', clearCart);

module.exports = router;
