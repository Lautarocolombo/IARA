const express = require('express');
const router = express.Router();
const { confirmTransferPayment, getPaymentStatus, getPaymentReconciliation } = require('../controllers/paymentController');
const { adminAuth } = require('../middleware/auth');
const { requireOrderToken } = require('../middleware/requireOrderToken');
const mercadopagoService = require('../services/mercadopagoService');

router.post('/payments/transfer', requireOrderToken, confirmTransferPayment);
router.get('/payments/transfer/status', getPaymentStatus);
router.get('/admin/payments/reconciliation', adminAuth, getPaymentReconciliation);

router.post('/payments/mercadopago/preference', adminAuth, async (req, res) => {
  try {
    const { items, payer_email, back_urls, notification_url } = req.body || {};
    const result = await mercadopagoService.createPreference(items, payer_email, back_urls, notification_url);
    if (result.error) {
      return res.status(500).json({ error: result.error, details: result.details });
    }
    res.json(result);
  } catch (err) {
    require('../lib/logger').error({ err: err.message }, 'Error creando preferencia MP');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/payments/mercadopago/status/:paymentId', adminAuth, async (req, res) => {
  try {
    const paymentId = Number(req.params.paymentId);
    if (!paymentId) return res.status(400).json({ error: 'paymentId inválido' });
    const result = await mercadopagoService.getPaymentStatus(paymentId);
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    require('../lib/logger').error({ err: err.message }, 'Error consultando estado MP');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/payments/mercadopago/payment-methods', adminAuth, async (req, res) => {
  try {
    const result = await mercadopagoService.getSupportedPaymentMethods();
    res.json({ payment_methods: result });
  } catch (err) {
    require('../lib/logger').error({ err: err.message }, 'Error obteniendo métodos de pago');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/payments/webhook/mercadopago', async (req, res) => {
  try {
    const result = await mercadopagoService.processWebhookNotification(req.body);
    if (result.processed) {
      return res.status(200).json({ accepted: true });
    }
    return res.status(202).json({ accepted: false, reason: result.reason || 'processing' });
  } catch (err) {
    require('../lib/logger').error({ err: err.message }, 'Error procesando webhook MP');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
