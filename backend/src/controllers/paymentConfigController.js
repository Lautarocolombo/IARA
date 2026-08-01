const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { adminAuth } = require('../middleware/auth');

const getPaymentConfigRow = async () => {
  const result = await query('SELECT * FROM payment_config LIMIT 1');
  return result.rows[0] || null;
};

const upsertPaymentConfig = async (data) => {
  const row = await getPaymentConfigRow();
  if (!row) {
    await query(
      `INSERT INTO payment_config (mp_alias, holder_name, whatsapp, message, active)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.mpAlias || '', data.holderName || '', data.whatsapp || '', data.message || '', data.active !== false]
    );
  } else {
    await query(
      `UPDATE payment_config SET mp_alias = $1, holder_name = $2, whatsapp = $3, message = $4, active = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
      [data.mpAlias || '', data.holderName || '', data.whatsapp || '', data.message || '', data.active !== false, row.id]
    );
  }
};

const getAdminPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      await query(
        `INSERT INTO payment_config (mp_alias, holder_name, whatsapp, message, active) VALUES ('', '', '', '', true)`
      );
      row = await getPaymentConfigRow();
    }
    res.json({
      mpAlias: row.mp_alias || '',
      holderName: row.holder_name || '',
      whatsapp: row.whatsapp || '',
      message: row.message || '',
      active: row.active !== false
    });
  } catch (err) {
    logger.error('Error obteniendo config de pago admin:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updatePaymentConfig = async (req, res) => {
  const { mpAlias, holderName, whatsapp, message, active } = req.body || {};
  try {
    await upsertPaymentConfig({
      mpAlias,
      holderName,
      whatsapp,
      message,
      active
    });
    res.json({
      ok: true,
      mpAlias: mpAlias || '',
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

const getPublicPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      res.json({
        mpAlias: '',
        whatsapp: (process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, ''),
        message: 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
        active: true
      });
      return;
    }
    res.json({
      mpAlias: row.mp_alias || '',
      whatsapp: (row.whatsapp || process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, ''),
      message: row.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
      active: row.active !== false
    });
  } catch (err) {
    logger.error('Error obteniendo config de pago pública:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAdminPaymentConfig,
  updatePaymentConfig,
  getPublicPaymentConfig
};
