const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getSiteTexts = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_texts');
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(map);
  } catch (err) {
    logger.error('Error obteniendo textos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertSiteText = async (req, res) => {
  const { key, value } = req.body || {};
  const resolvedKey = key || req.params.key;
  if (!resolvedKey || value === undefined) return res.status(400).json({ error: 'key y value son requeridos' });
  try {
    await query('INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [resolvedKey, value]);
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

    for (const key of keys) {
      try {
        await query('INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, String(texts[key] || '')]);
        results.saved += 1;
      } catch (err) {
        results.errors += 1;
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    logger.error('Error sincronizando textos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteTexts, upsertSiteText, syncTextsToNeon };
