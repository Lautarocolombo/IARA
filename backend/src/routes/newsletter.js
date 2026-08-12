const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const { newsletterSchema } = require('../lib/validators');
const logger = require('../lib/logger');

router.post('/subscribe', async (req, res) => {
  const parsed = newsletterSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
  }
  const { email } = parsed.data;
  try {
    await query('INSERT INTO subscribers (email, tenant_id) VALUES ($1, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) ON CONFLICT (email) DO NOTHING', [email]);
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error('Error suscribiendo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;