const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');

router.post('/subscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email válido requerido' });
  }
  try {
    await query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error('Error suscribiendo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;