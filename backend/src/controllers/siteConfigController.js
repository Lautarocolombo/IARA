const { query } = require('../lib/db');
const logger = require('../lib/logger');

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
        whatsapp: (paymentConfig.whatsapp || process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, ''),
        message: paymentConfig.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.',
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

module.exports = { getSiteConfig };
