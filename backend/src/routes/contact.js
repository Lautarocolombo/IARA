const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');

router.post('/contact', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    await query(
      'INSERT INTO contacts (name, email, message, status) VALUES ($1, $2, $3, $4)',
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
    const result = await query('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo contactos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;