const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { generateReceiptPDF, sendReceiptWhatsApp } = require('../controllers/receiptsController');

router.get('/admin/orders/:id/receipt', adminAuth, generateReceiptPDF);
router.get('/admin/orders/:id/receipt/whatsapp', adminAuth, sendReceiptWhatsApp);

const upload = require('../lib/upload');
router.post('/orders/:id/receipt', upload.uploadSingle, async (req, res) => {
  try {
    const { uploadReceipt } = require('../controllers/receiptsController');
    return uploadReceipt(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
