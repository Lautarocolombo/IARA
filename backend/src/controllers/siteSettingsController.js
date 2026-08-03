const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getSiteSettings = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    logger.error('Error obteniendo settings:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateSiteSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const keys = Object.keys(payload);
    for (const key of keys) {
      await query('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(payload[key])]);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error actualizando settings:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteSettings, updateSiteSettings };