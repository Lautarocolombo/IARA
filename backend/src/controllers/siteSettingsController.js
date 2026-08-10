const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { syncBus } = require('../routes/sync');
const { calculateShipping, DEFAULT_ZONES } = require('../lib/shipping');

async function fetchShippingZonesFromDb() {
  try {
    const result = await query("SELECT value FROM site_settings WHERE key = 'shipping_zones'");
    if (result.rows[0] && result.rows[0].value) {
      return JSON.parse(result.rows[0].value);
    }
  } catch (e) {
    logger.debug({ err: e.message }, 'Error obteniendo shipping_zones');
  }
  return DEFAULT_ZONES;
}

async function saveShippingZones(zones) {
  const current = await fetchShippingZonesFromDb();
  await query(
    'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP',
    ['shipping_zones', JSON.stringify(zones)]
  );
  return zones;
}

const getAdminShippingZones = async (req, res) => {
  try {
    const zones = await fetchShippingZonesFromDb();
    res.json(zones);
  } catch (err) {
    logger.error('Error obteniendo zonas de envío:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateAdminShippingZones = async (req, res) => {
  try {
    const zones = Array.isArray(req.body) ? req.body : [];
    const validated = zones.map(z => ({
      province: String(z.province || '').trim(),
      zipPatterns: Array.isArray(z.zipPatterns) ? z.zipPatterns.map(String) : [],
      cost: Number(z.cost || 0),
      freeFrom: Number(z.freeFrom || 0)
    }));
    await saveShippingZones(validated);
    res.json({ ok: true, zones: validated });
    try { syncBus.emit('settings_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error guardando zonas de envío:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

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
    const paymentFields = ['mp_enabled', 'cash_enabled', 'transfer_alias', 'cbu_cvu', 'holder_name', 'message', 'shipping_cost', 'free_shipping_from', 'mp_alias'];
    const hasPayment = paymentFields.some(f => payment[f] !== undefined || payload[f] !== undefined || payload[f.replace('_', '')] !== undefined);

    if (hasPayment) {
      const row = await query('SELECT * FROM payment_config LIMIT 1');
      const current = row.rows[0] || {};

      const mp_alias = payment.mp_alias !== undefined ? payment.mp_alias : (payload.mp_alias !== undefined ? payload.mp_alias : current.mp_alias || '');
      const transfer_alias = payment.transfer_alias !== undefined ? payment.transfer_alias : (payload.transfer_alias !== undefined ? payload.transfer_alias : current.transfer_alias || '');
      const holder_name = payment.holder_name !== undefined ? payment.holder_name : (payload.holder_name !== undefined ? payload.holder_name : current.holder_name || '');
      const cbu_cvu = payment.cbu_cvu !== undefined ? payment.cbu_cvu : (payload.cbu_cvu !== undefined ? payload.cbu_cvu : current.cbu_cvu || '');
      const whatsapp = payment.whatsapp !== undefined ? payment.whatsapp : (current.whatsapp || '');
      const message = payment.message !== undefined ? payment.message : (payload.payment_message !== undefined ? payload.payment_message : current.message || '');
      const active = payment.active !== undefined ? payment.active !== false : (current.active !== false);
      const mp_enabled = payment.mp_enabled !== undefined ? payment.mp_enabled !== false : (payload.mp_enabled !== undefined ? payload.mp_enabled !== false : current.mp_enabled || false);
      const cash_enabled = payment.cash_enabled !== undefined ? payment.cash_enabled !== false : (payload.cash_enabled !== undefined ? payload.cash_enabled !== false : current.cash_enabled || false);
      const shipping_cost = payment.shipping_cost !== undefined ? Number(payment.shipping_cost) : (payload.shipping_cost !== undefined ? Number(payload.shipping_cost) : current.shipping_cost || 0);
      const free_shipping_from = payment.free_shipping_from !== undefined ? Number(payment.free_shipping_from) : (payload.free_shipping_from !== undefined ? Number(payload.free_shipping_from) : current.free_shipping_from || 0);

      if (!transfer_alias && mp_alias) {
        // keep existing transfer_alias if not explicitly cleared
      }

      if (row.rows.length === 0) {
        await query(
          `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from]
        );
      } else {
        await query(
          'UPDATE payment_config SET mp_alias = $1, transfer_alias = $2, holder_name = $3, cbu_cvu = $4, whatsapp = $5, message = $6, active = $7, mp_enabled = $8, cash_enabled = $9, shipping_cost = $10, free_shipping_from = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12',
          [mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, row.rows[0].id]
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
      'UPDATE payment_config SET mp_alias = $1, transfer_alias = $2, holder_name = $3, cbu_cvu = $4, whatsapp = $5, message = $6, active = $7, mp_enabled = $8, cash_enabled = $9, shipping_cost = $10, free_shipping_from = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12',
      [data.mpAlias || '', data.transferAlias || '', data.holderName || '', data.cbuCvu || '', data.whatsapp || '', data.message || '', data.active !== false, data.mpEnabled !== false, data.cashEnabled !== false, Number(data.shippingCost) || 0, Number(data.freeShippingFrom) || 0, row.id]
    );
  }
};

const getAdminPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      await query(
        'INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from) VALUES (\'iara-salgueiro\', \'iara-salgueiro\', \'\', \'\', \'\', \'\', true, false, false, 0, 0)'
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

const calculateShippingCost = async (req, res) => {
  try {
    const { province, zip, subtotal } = req.query;
    const result = calculateShipping(province, zip, Number(subtotal || 0));
    res.json(result);
  } catch (err) {
    logger.error('Error calculando envío:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getShippingZones = async (req, res) => {
  try {
    const zones = await fetchShippingZonesFromDb();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(zones);
  } catch (err) {
    logger.error('Error obteniendo zonas de envío:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getSiteSettings,
  updateSiteSettings,
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getPublicPaymentConfig,
  getShippingZones,
  calculateShippingCost,
  getAdminShippingZones,
  updateAdminShippingZones
};
