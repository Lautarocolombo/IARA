const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const { contactSchema } = require('../lib/validators');
const logger = require('../lib/logger');

router.post('/contact', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
  }
  const { name, email, message } = parsed.data;
  try {
    await query(
      'INSERT INTO contacts (name, email, message, status, tenant_id) VALUES ($1, $2, $3, $4, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
      [name, email, message, 'new']
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error('Error guardando contacto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/admin/contacts', require('../middleware/auth').adminAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM contacts WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo contactos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;