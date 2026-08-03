const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getPaymentConfigRow = async () => {
  const result = await query('SELECT * FROM payment_config LIMIT 1');
  return result.rows[0] || null;
};

const upsertPaymentConfig = async (data) => {
  const row = await getPaymentConfigRow();
  if (!row) {
    await query(
      `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [data.mpAlias || '', data.transferAlias || '', data.holderName || '', data.cbuCvu || '', data.whatsapp || '', data.message || '', data.active !== false, data.mpEnabled !== false, data.cashEnabled !== false, Number(data.shippingCost) || 0, Number(data.freeShippingFrom) || 0]
    );
  } else {
    await query(
      `UPDATE payment_config SET mp_alias = $1, transfer_alias = $2, holder_name = $3, cbu_cvu = $4, whatsapp = $5, message = $6, active = $7, mp_enabled = $8, cash_enabled = $9, shipping_cost = $10, free_shipping_from = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12`,
      [data.mpAlias || '', data.transferAlias || '', data.holderName || '', data.cbuCvu || '', data.whatsapp || '', data.message || '', data.active !== false, data.mpEnabled !== false, data.cashEnabled !== false, Number(data.shippingCost) || 0, Number(data.freeShippingFrom) || 0, row.id]
    );
  }
};

const getAdminPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      await query(
        `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from) VALUES ('', '', '', '', '', '', true, false, false, 0, 0)`
      );
      row = await getPaymentConfigRow();
    }
    res.json({
      mpAlias: row.mp_alias || '',
      transferAlias: row.transfer_alias || '',
      holderName: row.holder_name || '',
      cbuCvu: row.cbu_cvu || '',
      whatsapp: row.whatsapp || '',
      message: row.message || '',
      active: row.active !== false,
      mpEnabled: row.mp_enabled !== false,
      cashEnabled: row.cash_enabled !== false,
      shippingCost: Number(row.shipping_cost || 0),
      freeShippingFrom: Number(row.free_shipping_from || 0)
    });
  } catch (err) {
    logger.error('Error obteniendo config de pago admin:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updatePaymentConfig = async (req, res) => {
  const { mpAlias, transferAlias, holderName, cbuCvu, whatsapp, message, active, mpEnabled, cashEnabled, shippingCost, freeShippingFrom } = req.body || {};
  try {
    await upsertPaymentConfig({
      mpAlias, transferAlias, holderName, cbuCvu, whatsapp, message, active,
      mpEnabled, cashEnabled, shippingCost, freeShippingFrom
    });
    res.json({
      ok: true,
      mpAlias: mpAlias || '',
      transferAlias: transferAlias || '',
      holderName: holderName || '',
      cbuCvu: cbuCvu || '',
      whatsapp: whatsapp || '',
      message: message || '',
      active: active !== false,
      mpEnabled: mpEnabled !== false,
      cashEnabled: cashEnabled !== false,
      shippingCost: Number(shippingCost) || 0,
      freeShippingFrom: Number(freeShippingFrom) || 0
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
        transferAlias: '',
        whatsapp: (process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, ''),
        message: 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
        active: true,
        mpEnabled: false,
        cashEnabled: false,
        shippingCost: 0,
        freeShippingFrom: 0
      });
      return;
    }
    res.json({
      transferAlias: row.transfer_alias || '',
      holderName: row.holder_name || '',
      cbuCvu: row.cbu_cvu || '',
      whatsapp: (row.whatsapp || process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, ''),
      message: row.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
      active: row.active !== false,
      mpEnabled: row.mp_enabled !== false,
      cashEnabled: row.cash_enabled !== false,
      shippingCost: Number(row.shipping_cost || 0),
      freeShippingFrom: Number(row.free_shipping_from || 0)
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
