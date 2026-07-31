const { query } = require('../lib/db');

const getSiteTexts = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_texts');
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json(map);
  } catch (err) {
    console.error('Error obteniendo textos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertSiteText = async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || value === undefined) return res.status(400).json({ error: 'key y value son requeridos' });
  try {
    await query('INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, value]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando texto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteTexts, upsertSiteText };
