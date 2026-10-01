const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { syncBus } = require('../routes/sync');
const { logAudit } = require('../lib/audit');

const getSiteSettings = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_settings WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
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
      business_name: settings.business_name || 'Artesanías Gualeguay',
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
      google_analytics_id: settings.google_analytics_id || '',
      facebook_pixel_id: settings.facebook_pixel_id || '',
      sentry_dsn: settings.sentry_dsn || '',
      google_place_id: settings.google_place_id || '',
      google_write_review_url: settings.google_write_review_url || '',
      google_maps_api_key: settings.google_maps_api_key || '',
      payment: {
        mp_alias: paymentConfig.mp_alias || '',
        mp_enabled: paymentConfig.mp_enabled !== false,
        cash_enabled: paymentConfig.cash_enabled !== false,
        transfer_alias: paymentConfig.transfer_alias || '',
        cbu_cvu: paymentConfig.cbu_cvu || '',
        holder_name: paymentConfig.holder_name || '',
        message: paymentConfig.message || '',
        shipping_cost: Number(paymentConfig.shipping_cost || 0),
        free_shipping_from: Number(paymentConfig.free_shipping_from || 0),
        included_shipping_cost: Number(paymentConfig.included_shipping_cost || 0)
      }
    });
  } catch (err) {
    logger.error('Error obteniendo settings:', err);
    const debug = process.env.DEBUG_API_ERROR;
    res.status(500).json({ error: debug ? err.message : 'Error interno del servidor' });
  }
};

const updateSiteSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const settings = {};

    const settingKeys = ['business_name', 'logo', 'email', 'phone', 'whatsapp', 'address', 'instagram', 'facebook', 'whatsapp_business', 'twitter', 'google_analytics_id', 'facebook_pixel_id', 'sentry_dsn', 'google_place_id', 'google_write_review_url', 'google_maps_api_key', 'slogan', 'year_founded', 'lat', 'lng'];
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
        'INSERT INTO site_settings (key, value, tenant_id) VALUES ($1, $2, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP, tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')',
        [key, String(value)]
      );
    }

    const payment = payload.payment || payload || {};
    const paymentFields = ['mp_enabled', 'cash_enabled', 'transfer_alias', 'cbu_cvu', 'holder_name', 'message', 'shipping_cost', 'free_shipping_from', 'included_shipping_cost', 'mp_alias', 'notify_admin_new_proof', 'notify_client_approved', 'notify_client_rejected'];
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
      const included_shipping_cost = payment.included_shipping_cost !== undefined ? Number(payment.included_shipping_cost) : (payload.included_shipping_cost !== undefined ? Number(payload.included_shipping_cost) : current.included_shipping_cost || 0);
      const notify_admin_new_proof = payment.notify_admin_new_proof !== undefined ? payment.notify_admin_new_proof !== false : (current.notify_admin_new_proof || false);
      const notify_client_approved = payment.notify_client_approved !== undefined ? payment.notify_client_approved !== false : (current.notify_client_approved || false);
      const notify_client_rejected = payment.notify_client_rejected !== undefined ? payment.notify_client_rejected !== false : (current.notify_client_rejected || false);

      if (!transfer_alias && mp_alias) {
        // keep existing transfer_alias if not explicitly cleared
      }

      if (row.rows.length === 0) {
        await query(
          `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, included_shipping_cost, notify_admin_new_proof, notify_client_approved, notify_client_rejected)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, included_shipping_cost, notify_admin_new_proof, notify_client_approved, notify_client_rejected]
        );
      } else {
        await query(
          'UPDATE payment_config SET mp_alias = $1, transfer_alias = $2, holder_name = $3, cbu_cvu = $4, whatsapp = $5, message = $6, active = $7, mp_enabled = $8, cash_enabled = $9, shipping_cost = $10, free_shipping_from = $11, included_shipping_cost = $12, notify_admin_new_proof = $13, notify_client_approved = $14, notify_client_rejected = $15, updated_at = CURRENT_TIMESTAMP WHERE id = $16',
          [mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, included_shipping_cost, notify_admin_new_proof, notify_client_approved, notify_client_rejected, row.rows[0].id]
        );
      }
    }

    logger.info({ settingsKeys: Object.keys(settings), hasPayment }, 'updateSiteSettings: configuración actualizada');
    res.json({ ok: true });
    try { syncBus.emit('settings_updated', {}); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'update',
      entityType: 'site_settings',
      entityId: 0,
      details: `Configuración del sitio actualizada: ${Object.keys(settings).length} claves`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error actualizando settings:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function getPaymentConfigRow() {
  const result = await query('SELECT * FROM payment_config LIMIT 1');
  return result.rows[0] || null;
}

const PAYMENT_CONFIG_FIELDS = [
  { key: 'mpAlias', column: 'mp_alias', type: 'string' },
  { key: 'transferAlias', column: 'transfer_alias', type: 'string' },
  { key: 'holderName', column: 'holder_name', type: 'string' },
  { key: 'cbuCvu', column: 'cbu_cvu', type: 'string' },
  { key: 'whatsapp', column: 'whatsapp', type: 'string' },
  { key: 'message', column: 'message', type: 'string' },
  { key: 'active', column: 'active', type: 'boolean' },
  { key: 'mpEnabled', column: 'mp_enabled', type: 'boolean' },
  { key: 'cashEnabled', column: 'cash_enabled', type: 'boolean' },
  { key: 'shippingCost', column: 'shipping_cost', type: 'number' },
  { key: 'freeShippingFrom', column: 'free_shipping_from', type: 'number' },
  { key: 'includedShippingCost', column: 'included_shipping_cost', type: 'number' },
  { key: 'notifyAdminNewProof', column: 'notify_admin_new_proof', type: 'boolean' },
  { key: 'notifyClientApproved', column: 'notify_client_approved', type: 'boolean' },
  { key: 'notifyClientRejected', column: 'notify_client_rejected', type: 'boolean' }
];

const PAYMENT_CONFIG_DEFAULTS = {
  mpAlias: '', transferAlias: '', holderName: '', cbuCvu: '', whatsapp: '', message: '',
  active: true, mpEnabled: true, cashEnabled: true,
  shippingCost: 0, freeShippingFrom: 0, includedShippingCost: 0,
  notifyAdminNewProof: true, notifyClientApproved: true, notifyClientRejected: true
};

function castPaymentValue(value, type) {
  if (type === 'boolean') return value !== false;
  if (type === 'number') return Number(value) || 0;
  return value || '';
}

const upsertPaymentConfig = async (data) => {
  const row = await getPaymentConfigRow();
  const provided = PAYMENT_CONFIG_FIELDS.filter(f => data[f.key] !== undefined);

  if (!row) {
    const values = PAYMENT_CONFIG_FIELDS.map(f => (
      data[f.key] !== undefined ? castPaymentValue(data[f.key], f.type) : PAYMENT_CONFIG_DEFAULTS[f.key]
    ));
    await query(
      `INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, included_shipping_cost, notify_admin_new_proof, notify_client_approved, notify_client_rejected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      values
    );
    return;
  }

  if (provided.length === 0) return;

  const setParts = [];
  const values = [];
  provided.forEach((field, i) => {
    setParts.push(`${field.column} = $${i + 1}`);
    values.push(castPaymentValue(data[field.key], field.type));
  });
  values.push(row.id);
  await query(
    `UPDATE payment_config SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`,
    values
  );
};

const mapPaymentRow = (row) => ({
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
  freeShippingFrom: Number(row.free_shipping_from || 0),
  includedShippingCost: Number(row.included_shipping_cost || 0),
  notifyAdminNewProof: row.notify_admin_new_proof !== false,
  notifyClientApproved: row.notify_client_approved !== false,
  notifyClientRejected: row.notify_client_rejected !== false
});

const getAdminPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      await query(
        'INSERT INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, notify_admin_new_proof, notify_client_approved, notify_client_rejected) VALUES (\'iara-salgueiro\', \'iara-salgueiro\', \'\', \'\', \'\', \'\', true, false, false, 0, 0, true, true, true)'
      );
      row = await getPaymentConfigRow();
    }
    res.json(mapPaymentRow(row));
  } catch (err) {
    logger.error('Error obteniendo config de pago admin:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateAdminPaymentConfig = async (req, res) => {
  const { mpAlias, transferAlias, holderName, cbuCvu, whatsapp, message, active, mpEnabled, cashEnabled, shippingCost, freeShippingFrom, includedShippingCost, notifyAdminNewProof, notifyClientApproved, notifyClientRejected } = req.body || {};
  try {
    await upsertPaymentConfig({
      mpAlias, transferAlias, holderName, cbuCvu, whatsapp, message, active,
      mpEnabled, cashEnabled, shippingCost, freeShippingFrom, includedShippingCost,
      notifyAdminNewProof, notifyClientApproved, notifyClientRejected
    });
    logger.info({ mpAlias, transferAlias, active, mpEnabled, cashEnabled }, 'updateAdminPaymentConfig: configuración de pago actualizada');
    res.json({
      ok: true,
      ...mapPaymentRow(await getPaymentConfigRow())
    });
    try { syncBus.emit('settings_updated', {}); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'update',
      entityType: 'payment_config',
      entityId: 0,
      details: `Configuración de pago actualizada: ${mpAlias || 'n/a'}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error guardando config de pago:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function normalizeWhatsAppPhone(phone) {
  let cleaned = String(phone || '').replace(/[^\d]/g, '');
  if (cleaned.startsWith('549')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('54')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('15')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (!cleaned.startsWith('54') && cleaned.length >= 10) {
    cleaned = `54${cleaned}`;
  }
  return cleaned;
}

const getPublicPaymentConfig = async (req, res) => {
  try {
    let row = await getPaymentConfigRow();
    if (!row) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.json({
        transferAlias: '',
        whatsapp: normalizeWhatsAppPhone(process.env.WHATSAPP || '+543444634444'),
        message: 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
        active: true,
        mpEnabled: false,
        cashEnabled: false,
        shippingCost: 0,
        freeShippingFrom: 0,
        notifyAdminNewProof: true,
        notifyClientApproved: true,
        notifyClientRejected: true
      });
      return;
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      transferAlias: row.transfer_alias || '',
      holderName: row.holder_name || '',
      cbuCvu: row.cbu_cvu || '',
      whatsapp: normalizeWhatsAppPhone(row.whatsapp || process.env.WHATSAPP || '+543444634444'),
      message: row.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
      active: row.active !== false,
      mpEnabled: row.mp_enabled !== false,
      cashEnabled: row.cash_enabled !== false,
      shippingCost: Number(row.shipping_cost || 0),
      freeShippingFrom: Number(row.free_shipping_from || 0),
      includedShippingCost: Number(row.included_shipping_cost || 0),
      notifyAdminNewProof: row.notify_admin_new_proof !== false,
      notifyClientApproved: row.notify_client_approved !== false,
      notifyClientRejected: row.notify_client_rejected !== false
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
