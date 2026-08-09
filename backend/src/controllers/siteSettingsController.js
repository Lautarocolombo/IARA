const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { syncBus } = require('../routes/sync');

const getSiteSettings = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });

    const paymentRow = await query('SELECT * FROM payment_config LIMIT 1');
    let paymentConfig = paymentRow.rows[0] || {};

    if (!Object.keys(paymentConfig).length) {
      await query(
        `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from)
         VALUES ('iara-salgueiro', 'iara-salgueiro', '', '', '', '', true, false, false, 0, 0)`
      );
      const retry = await query('SELECT * FROM payment_config LIMIT 1');
      paymentConfig = retry.rows[0];
    }

    const shippingZonesRaw = settings.shipping_zones || paymentConfig.shipping_zones || '[]';
    let shippingZones = [];
    try { shippingZones = JSON.parse(shippingZonesRaw); } catch (e) { shippingZones = []; }

    const socials = {};
    ['instagram', 'facebook', 'whatsapp_business', 'twitter'].forEach(k => {
      if (settings[k]) socials[k] = settings[k];
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      business_name: settings.business_name || 'Artesanía Gualeguay',
      logo: settings.logo || '',
      email: settings.email || '',
      phone: settings.phone || '',
      whatsapp: settings.whatsapp || '',
      address: settings.address || '',
      instagram: settings.instagram || '',
      facebook: settings.facebook || '',
      whatsapp_business: settings.whatsapp_business || '',
      twitter: settings.twitter || '',
      socials,
      shipping_zones: shippingZones,
      payment: {
        mp_alias: paymentConfig.mp_alias || '',
        mp_enabled: paymentConfig.mp_enabled !== false,
        cash_enabled: paymentConfig.cash_enabled !== false,
        transfer_alias: paymentConfig.transfer_alias || '',
        cbu_cvu: paymentConfig.cbu_cvu || '',
        holder_name: paymentConfig.holder_name || '',
        message: paymentConfig.message || '',
        shipping_cost: Number(paymentConfig.shipping_cost || 0),
        free_shipping_from: Number(paymentConfig.free_shipping_from || 0)
      }
    });
  } catch (err) {
    logger.error('Error obteniendo settings:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateSiteSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const settings = {};

    const settingKeys = ['business_name', 'logo', 'email', 'phone', 'whatsapp', 'address', 'instagram', 'facebook', 'whatsapp_business', 'twitter'];
    settingKeys.forEach(key => {
      if (payload[key] !== undefined) {
        settings[key] = payload[key];
      }
    });

    if (payload.shipping_zones) {
      settings.shipping_zones = typeof payload.shipping_zones === 'string' ? payload.shipping_zones : JSON.stringify(payload.shipping_zones);
    }

    for (const [key, value] of Object.entries(settings)) {
      await query(
        'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP',
        [key, String(value)]
      );
    }

    const payment = payload.payment || payload || {};
    const hasPayment = payment.mp_enabled !== undefined || payment.cash_enabled !== undefined || payment.transfer_alias !== undefined || payment.cbu_cvu !== undefined || payment.holder_name !== undefined || payment.message !== undefined || payment.shipping_cost !== undefined || payment.free_shipping_from !== undefined || (payload.mp_enabled !== undefined) || (payload.cash_enabled !== undefined) || (payload.mp_alias !== undefined) || (payload.shipping_zones !== undefined);

    if (hasPayment) {
      const row = await query('SELECT id FROM payment_config LIMIT 1');
      const values = {
        mp_alias: payment.mp_alias !== undefined ? payment.mp_alias : (payload.mp_alias !== undefined ? payload.mp_alias : ''),
        transfer_alias: payment.transfer_alias !== undefined ? payment.transfer_alias : (payload.transfer_alias !== undefined ? payload.transfer_alias : ''),
        holder_name: payment.holder_name !== undefined ? payment.holder_name : (payload.holder_name !== undefined ? payload.holder_name : ''),
        cbu_cvu: payment.cbu_cvu !== undefined ? payment.cbu_cvu : (payload.cbu_cvu !== undefined ? payload.cbu_cvu : ''),
        whatsapp: payment.whatsapp !== undefined ? payment.whatsapp : '',
        message: payment.message !== undefined ? payment.message : (payload.payment_message !== undefined ? payload.payment_message : ''),
        active: payment.active !== undefined ? payment.active !== false : true,
        mp_enabled: payment.mp_enabled !== undefined ? payment.mp_enabled !== false : (payload.mp_enabled !== undefined ? payload.mp_enabled !== false : false),
        cash_enabled: payment.cash_enabled !== undefined ? payment.cash_enabled !== false : (payload.cash_enabled !== undefined ? payload.cash_enabled !== false : false),
        shipping_cost: payment.shipping_cost !== undefined ? Number(payment.shipping_cost) : (payload.shipping_cost !== undefined ? Number(payload.shipping_cost) : 0),
        free_shipping_from: payment.free_shipping_from !== undefined ? Number(payment.free_shipping_from) : (payload.free_shipping_from !== undefined ? Number(payload.free_shipping_from) : 0)
      };

      if (!values.transfer_alias && values.mp_alias) {
        values.transfer_alias = values.mp_alias;
      }

      if (row.rows.length === 0) {
        await query(
          `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [values.mp_alias, values.transfer_alias, values.holder_name, values.cbu_cvu, values.whatsapp, values.message, values.active, values.mp_enabled, values.cash_enabled, values.shipping_cost, values.free_shipping_from]
        );
      } else {
        await query(
          `UPDATE payment_config SET mp_alias = $1, transfer_alias = $2, holder_name = $3, cbu_cvu = $4, whatsapp = $5, message = $6, active = $7, mp_enabled = $8, cash_enabled = $9, shipping_cost = $10, free_shipping_from = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12`,
          [values.mp_alias, values.transfer_alias, values.holder_name, values.cbu_cvu, values.whatsapp, values.message, values.active, values.mp_enabled, values.cash_enabled, values.shipping_cost, values.free_shipping_from, row.rows[0].id]
        );
      }
    }

    res.json({ ok: true });
    try { syncBus.emit('settings_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error actualizando settings:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function getPaymentConfigRow() {
  const result = await query('SELECT * FROM payment_config LIMIT 1');
  return result.rows[0] || null;
}

const upsertPaymentConfig = async (data) => {
  const row = await getPaymentConfigRow();
  if (!row) {
    await query(
      `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)`,
      [data.mpAlias || '', data.transferAlias || '', data.holderName || '', data.cbuCvu || '', data.whatsapp || '', data.message || '', data.mpEnabled !== false, data.cashEnabled !== false, Number(data.shippingCost) || 0, Number(data.freeShippingFrom) || 0]
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
        `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from) VALUES ('iara-salgueiro', 'iara-salgueiro', '', '', '', '', true, false, false, 0, 0)`
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

const updateAdminPaymentConfig = async (req, res) => {
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
    try { syncBus.emit('settings_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error guardando config de pago:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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
  getSiteSettings,
  updateSiteSettings,
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getPublicPaymentConfig
};
