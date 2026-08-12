const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { deleteFromBlob } = require('../lib/upload');
const path = require('path');
const fs = require('fs');
const { syncBus } = require('../routes/sync');

function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  if (!text.includes('�')) return text;
  const fixes = [
    [/Cada pieza es .nica\./g, 'Cada pieza es única.'],
    [/Explorar Cat.logo/g, 'Explorar Catálogo'],
    [/Hecho a mano/g, 'Hecho a mano'],
    [/Env.o gratis/g, 'Envío gratis'],
    [/Materiales premium/g, 'Materiales premium'],
    [/Para regalar/g, 'Para regalar'],
    [/Artesan.a con alma/g, 'Artesanía con alma'],
    [/Regalos artesanales/g, 'Regalos artesanales'],
    [/Pulseras, souvenirs/g, 'Pulseras, souvenirs'],
    [/hechos a mano/g, 'hechos a mano'],
    [/Cada pieza/.nica/g, 'Cada pieza única'],
    [/Compra mayor a ARS/g, 'Compra mayor a ARS'],
    [/Lunes a domingo/g, 'Lunes a domingo'],
    [/9:00 a 20:00/g, '9:00 a 20:00'],
    [/San Antonio Norte/g, 'San Antonio Norte'],
    [/Gualeguay, Entre R.g, 'Gualeguay, Entre Ríos'],
    [/chicafittargentina@gmail.com/g, 'chicafittargentina@gmail.com'],
    [/\+54 \(3444\) 634-4444/g, '+54 (3444) 634-4444'],
    [/\+5493444634444/g, '+5493444634444']
  ];
  let result = text;
  fixes.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  if (result.includes('�')) {
    result = result.replace(/�/g, '');
  }
  return result;
}

const getSiteTexts = async (req, res) => {
  try {
    const result = await query('SELECT key, value, updated_at FROM site_texts WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
    const map = {};
    let maxUpdated = null;
    result.rows.forEach(r => {
      map[r.key] = sanitizeText(r.value);
      if (!maxUpdated || new Date(r.updated_at) > new Date(maxUpdated)) {
        maxUpdated = r.updated_at;
      }
    });
    if (maxUpdated) {
      map.__updatedAt = maxUpdated;
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(map);
  } catch (err) {
    console.error('siteTexts error', err);
    logger.error('Error obteniendo textos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertSiteText = async (req, res) => {
  const { key, value } = req.body || {};
  const resolvedKey = key || req.params.key;
  if (!resolvedKey || value === undefined) return res.status(400).json({ error: 'key y value son requeridos' });
  try {
    await query('INSERT INTO site_texts (key, value, tenant_id) VALUES ($1, $2, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [resolvedKey, value]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error guardando texto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const syncTextsToNeon = async (req, res) => {
  try {
    const texts = req.body && typeof req.body === 'object' ? req.body : {};
    const keys = Object.keys(texts);
    const results = { saved: 0, errors: 0 };

    let existingMap = {};
    try {
      const existing = await query('SELECT key, value FROM site_texts WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
      existing.rows.forEach(function(r) { existingMap[r.key] = r.value; });
    } catch (err) {
      logger.warn({ err: err.message }, 'Error obteniendo textos existentes para limpieza de imágenes');
    }

    for (const key of keys) {
      try {
        const newValue = String(texts[key] || '');
        const oldValue = existingMap[key] || '';

        if ((key === 'hero_image_url' || key === 'featured_product_image_url') && oldValue && !newValue) {
          try {
            if (oldValue.startsWith('http')) {
              await deleteFromBlob(oldValue);
            } else if (oldValue.startsWith('/uploads/')) {
              const filePath = path.join(__dirname, '..', '..', oldValue);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (imgErr) {
            logger.warn({ err: imgErr.message }, 'Error eliminando imagen anterior de ' + key);
          }
        }

        await query('INSERT INTO site_texts (key, value, tenant_id) VALUES ($1, $2, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, newValue]);
        results.saved += 1;
      } catch (err) {
        results.errors += 1;
      }
    }

    try {
      const maxResult = await query('SELECT MAX(updated_at) as max_updated FROM site_texts WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
      const maxUpdated = maxResult.rows[0]?.max_updated || null;
      try { syncBus.emit('site_texts_updated', { updatedAt: maxUpdated }); } catch (e) { /* noop */ }
      res.json({ ok: true, results, updatedAt: maxUpdated });
    } catch (err) {
      logger.error('Error obteniendo updatedAt tras sync:', err);
      try { syncBus.emit('site_texts_updated', {}); } catch (e) { /* noop */ }
      res.json({ ok: true, results });
    }
  } catch (err) {
    logger.error('Error sincronizando textos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteTexts, upsertSiteText, syncTextsToNeon };
