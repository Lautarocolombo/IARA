const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { generateReceiptPDF, sendReceiptWhatsApp } = require('../controllers/receiptsController');

router.get('/admin/orders/:id/receipt', adminAuth, generateReceiptPDF);
router.get('/admin/orders/:id/receipt/whatsapp', adminAuth, sendReceiptWhatsApp);

module.exports = router;
