const { query } = require('../lib/db');
const logger = require('../lib/logger');

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

function normalizeWhatsAppForWaMe(phone) {
  let cleaned = normalizeWhatsAppPhone(phone);
  if (cleaned.startsWith('549')) {
    cleaned = '54' + cleaned.slice(3);
  }
  return cleaned;
}

const getPublicConfig = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_settings WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });

    const paymentRow = await query('SELECT * FROM payment_config LIMIT 1');
    const paymentConfig = paymentRow.rows[0] || {};

    const socials = {};
    ['instagram', 'facebook', 'whatsapp_business', 'twitter'].forEach(k => {
      if (settings[k]) socials[k] = settings[k];
    });

    const googlePlaceId = settings.google_place_id || process.env.GOOGLE_PLACE_ID || '';
    const googleWriteReviewUrl = settings.google_write_review_url || process.env.GOOGLE_WRITE_REVIEW_URL || '';

    const rawWhatsApp = settings.whatsapp || process.env.WHATSAPP || '+543444634444';
    const whatsappForWaMe = normalizeWhatsAppForWaMe(rawWhatsApp);

    const config = {
      CONTACT: {
        WHATSAPP: whatsappForWaMe,
        WHATSAPP_ALIAS: settings.whatsapp_business || 'iara-salgueiro',
        PHONE: settings.phone || '+54 (3444) 634-4444',
        EMAIL: settings.email || 'noreply@artesaniagualeguay.com',
        ADDRESS: settings.address || 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina',
        COORDINATES: {
          lat: Number(settings.lat || -33.1400009),
          lng: Number(settings.lng || -59.3136349)
        },
        GOOGLE_MAPS_API_KEY: settings.google_maps_api_key || ''
      },
      REVIEWS: {
        GOOGLE_PLACE_ID: googlePlaceId,
        GOOGLE_WRITE_REVIEW_URL: googleWriteReviewUrl
      },
      CART: {
        SHIPPING_COST: Number(paymentConfig.shipping_cost || settings.shipping_cost || process.env.SHIPPING_COST || 200),
        SHIPPING_THRESHOLD: Number(paymentConfig.free_shipping_from || settings.free_shipping_from || process.env.SHIPPING_THRESHOLD || 2000),
        FREE_SHIPPING_TEXT: 'Envío Gratis'
      },
      THEME: {
        STORAGE_KEY: 'ag_theme',
        DEFAULT: 'light',
        OPTIONS: ['light', 'dark']
      },
      BUSINESS: {
        NAME: settings.business_name || 'Artesanías Gualeguay',
        SLOGAN: settings.slogan || 'Regalos artesanales que cuentan historias',
        LOGO: settings.logo || '🌸',
        YEAR_FOUNDED: Number(settings.year_founded || 2021)
      },
      ANALYTICS: {
        GOOGLE_ID: settings.google_analytics_id || process.env.GOOGLE_ANALYTICS_ID || '',
        FACEBOOK_PIXEL_ID: settings.facebook_pixel_id || process.env.FACEBOOK_PIXEL_ID || '',
        SENTRY_DSN: settings.sentry_dsn || process.env.SENTRY_DSN || ''
      },
      ANIMATIONS: {
        REVEAL_THRESHOLD: 0.15,
        TOAST_DURATION: 3000,
        TRANSITION_SPEED: 0.4
      },
      API: {
        BASE: '',
        BACKEND_URL: process.env.BACKEND_URL || ''
      },
      PLACEHOLDER: {
        IMAGE: 'assets/placeholder-product.svg'
      },
      LINKS: {
        INSTAGRAM: settings.instagram || 'https://www.instagram.com/artesaniagualeguay',
        FACEBOOK: settings.facebook || 'https://www.facebook.com/artesaniagualeguay',
        TWITTER: settings.twitter || ''
      },
      HOURS: {
        WEEKDAY: { open: '00:00', close: '23:59' },
        SATURDAY: { open: '00:00', close: '23:59' },
        CLOSED: []
      },
      PAYMENT: {
        transferAlias: paymentConfig.transfer_alias || '',
        holderName: paymentConfig.holder_name || '',
        cbuCvu: paymentConfig.cbu_cvu || '',
        whatsapp: whatsappForWaMe,
        message: paymentConfig.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
        active: paymentConfig.active !== false,
        cashEnabled: paymentConfig.cash_enabled !== false,
        shippingCost: Number(paymentConfig.shipping_cost || 0),
        freeShippingFrom: Number(paymentConfig.free_shipping_from || 0),
        includedShippingCost: Number(paymentConfig.included_shipping_cost || 0)
      },
      SITE_URL: settings.site_url || process.env.SITE_URL || 'https://artesania-gualeguay-v3.vercel.app',
      GOOGLE_SITE_VERIFICATION: settings.google_site_verification || process.env.GOOGLE_SITE_VERIFICATION || 'yvZpAuNkB_dICE9gkXzvgbShhQMuPXQuKVpNwdYt9ig'
    };

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(config);
  } catch (err) {
    logger.error('Error obteniendo configuración pública:', err);
    const debug = process.env.DEBUG_API_ERROR;
    res.status(500).json({ error: debug ? err.message : 'Error interno del servidor' });
  }
};

module.exports = { getPublicConfig };