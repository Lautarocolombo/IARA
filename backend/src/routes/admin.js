const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { runMigrationsOnly } = require('../lib/db');

router.post('/run-migrations', adminAuth, async (req, res) => {
  try {
    await runMigrationsOnly();
    res.json({ ok: true, message: 'Migraciones ejecutadas correctamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;