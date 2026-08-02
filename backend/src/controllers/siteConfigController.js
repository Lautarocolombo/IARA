const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { adminAuth } = require('../middleware/auth');

const getSiteConfig = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_texts');
    const config = {};
    result.rows.forEach(r => { config[r.key] = r.value; });

    const paymentRow = await query('SELECT * FROM payment_config LIMIT 1');
    let paymentConfig = paymentRow.rows[0] || null;
    if (!paymentConfig) {
      await query(
        `INSERT INTO payment_config (transfer_alias, holder_name, whatsapp, message, active) VALUES ('', '', '', '', true)`
      );
      const retry = await query('SELECT * FROM payment_config LIMIT 1');
      paymentConfig = retry.rows[0] || {};
    }

    const publicConfig = {
      analytics: {
        googleId: '',
        facebookPixelId: ''
      },
payment: {
        transferAlias: paymentConfig.transfer_alias || config['transfer_alias'] || '',
        holderName: paymentConfig.holder_name || '',
        whatsapp: (paymentConfig.whatsapp || process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, ''),
        message: paymentConfig.message || 'TransferÃ­ el total exacto y enviÃ¡ el comprobante por WhatsApp para confirmar tu pedido.',
        active: paymentConfig.active !== false
      },
      siteName: 'Artesanía Gualeguay',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(publicConfig);
  } catch (err) {
    logger.error('Error obteniendo config del sitio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updatePaymentConfig = async (req, res) => {
  const { transferAlias, holderName, whatsapp, message, active } = req.body || {};
  try {
    const row = await query('SELECT * FROM payment_config LIMIT 1');
    if (!row.rows[0]) {
      await query(
        `INSERT INTO payment_config (transfer_alias, holder_name, whatsapp, message, active)
         VALUES ($1, $2, $3, $4, $5)`,
        [transferAlias || '', holderName || '', whatsapp || '', message || '', active !== false]
      );
    } else {
      await query(
        `UPDATE payment_config SET transfer_alias = $1, holder_name = $2, whatsapp = $3, message = $4, active = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
        [transferAlias || '', holderName || '', whatsapp || '', message || '', active !== false, row.rows[0].id]
      );
    }
    res.json({
      ok: true,
      transferAlias: transferAlias || '',
      holderName: holderName || '',
      whatsapp: whatsapp || '',
      message: message || '',
      active: active !== false
    });
  } catch (err) {
    logger.error('Error guardando config de pago:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteConfig, updatePaymentConfig };