const { query } = require('../lib/db');

const getSettings = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_texts');
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json({
      business: {
        name: map['business_name'] || process.env.BUSINESS_NAME || 'Artesanía Gualeguay',
        email: map['business_email'] || process.env.BUSINESS_EMAIL || 'contacto@artesaniagualeguay.com',
        whatsapp: map['business_whatsapp'] || process.env.WHATSAPP || '+5493444634444',
        instagram: map['business_instagram'] || process.env.INSTAGRAM_URL || '#',
        facebook: map['business_facebook'] || process.env.FACEBOOK_URL || '#',
        twitter: map['business_twitter'] || process.env.TWITTER_URL || '#'
      },
      shipping: {
        cost: Number(map['shipping_cost'] || process.env.SHIPPING_COST || 200),
        threshold: Number(map['shipping_threshold'] || process.env.SHIPPING_THRESHOLD || 2000)
      },
      site: {
        title: map['site_title'] || 'Artesanía Gualeguay',
        description: map['site_description'] || 'Regalos artesanales que cuentan historias',
        keywords: map['site_keywords'] || 'artesanía, pulseras, souvenirs, Gualeguay'
      }
    });
  } catch (err) {
    console.error('Error obteniendo configuración:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateSettings = async (req, res) => {
  const { business, shipping, site } = req.body || {};
  try {
    const updates = [];
    if (business) {
      updates.push(['business_name', business.name || '']);
      updates.push(['business_email', business.email || '']);
      updates.push(['business_whatsapp', business.whatsapp || '']);
      updates.push(['business_instagram', business.instagram || '#']);
      updates.push(['business_facebook', business.facebook || '#']);
      updates.push(['business_twitter', business.twitter || '#']);
    }
    if (shipping) {
      updates.push(['shipping_cost', String(shipping.cost || 200)]);
      updates.push(['shipping_threshold', String(shipping.threshold || 2000)]);
    }
    if (site) {
      updates.push(['site_title', site.title || '']);
      updates.push(['site_description', site.description || '']);
      updates.push(['site_keywords', site.keywords || '']);
    }
    for (const [key, value] of updates) {
      await query('INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, value]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando configuración:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSettings, updateSettings };