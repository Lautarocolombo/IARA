const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { adminAuth } = require('../middleware/auth');

const getSiteConfig = async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM site_texts');
    const config = {};
    result.rows.forEach(r => { config[r.key] = r.value; });

    const publicConfig = {
      analytics: {
        googleId: '',
        facebookPixelId: ''
      },
      payment: {
        mpPublicKey: '',
        mpAlias: config['mp_alias'] || '',
        whatsapp: config['payment_whatsapp'] || process.env.WHATSAPP || '+5493444634444',
        instructions: config['payment_instructions'] || ''
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

const updatePaymentConfig = async (req, res) => {
  const { mpAlias, whatsapp, instructions } = req.body || {};
  try {
    await query(
      'INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      ['mp_alias', mpAlias || '']
    );
    await query(
      'INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      ['payment_whatsapp', whatsapp || '']
    );
    await query(
      'INSERT INTO site_texts (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      ['payment_instructions', instructions || '']
    );
    res.json({ ok: true, mpAlias: mpAlias || '', whatsapp: whatsapp || '', instructions: instructions || '' });
  } catch (err) {
    logger.error('Error guardando config de pago:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSiteConfig, updatePaymentConfig };