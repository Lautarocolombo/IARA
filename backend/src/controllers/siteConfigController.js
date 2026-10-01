const { query } = require('../lib/db');
const logger = require('../lib/logger');

// ⚠️ NÚMERO WhatsApp: formato E.164 SIN 9 para Argentina → 543444634444
// CONFIRMAR con el dueño antes de producción.
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
  if (!cleaned.startsWith('54') && cleaned.length >= 10) {
    cleaned = `54${cleaned}`;
  }
  return cleaned;
}

const getSiteConfig = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_texts');
    const config = {};
    result.rows.forEach(r => { config[r.key] = r.value; });

    const paymentRow = await query('SELECT * FROM payment_config LIMIT 1');
    let paymentConfig = paymentRow.rows[0] || null;
    if (!paymentConfig) {
      await query(
        'INSERT INTO payment_config (mp_alias, holder_name, whatsapp, message, active) VALUES (\'iara-salgueiro\', \'\', \'\', \'\', true)'
      );
      const retry = await query('SELECT * FROM payment_config LIMIT 1');
      paymentConfig = retry.rows[0] || {};
    }

    const publicConfig = {
      analytics: {
        googleId: config['google_analytics_id'] || process.env.GOOGLE_ANALYTICS_ID || '',
        facebookPixelId: config['facebook_pixel_id'] || process.env.FACEBOOK_PIXEL_ID || ''
      },
      payment: {
        mpAlias: paymentConfig.mp_alias || config['mp_alias'] || '',
        holderName: paymentConfig.holder_name || '',
        whatsapp: normalizeWhatsAppPhone(paymentConfig.whatsapp || process.env.WHATSAPP || '+543444634444'),
        message: paymentConfig.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
        active: paymentConfig.active !== false,
        notifyAdminNewProof: paymentConfig.notify_admin_new_proof !== false,
        notifyClientApproved: paymentConfig.notify_client_approved !== false,
        notifyClientRejected: paymentConfig.notify_client_rejected !== false
      },
      siteName: 'Artesanías Gualeguay',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(publicConfig);
  } catch (err) {
    logger.error('Error obteniendo config del sitio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteConfig };
