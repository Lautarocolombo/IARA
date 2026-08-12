const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { deleteFromBlob } = require('../lib/upload');
const path = require('path');
const fs = require('fs');
const { syncBus } = require('../routes/sync');

const getSiteTexts = async (req, res) => {
  try {
    const result = await query('SELECT key, value, updated_at FROM site_texts WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
    const map = {};
    let maxUpdated = null;
    result.rows.forEach(r => {
      map[r.key] = r.value;
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
