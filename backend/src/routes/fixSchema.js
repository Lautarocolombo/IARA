const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

const DEBUG_TOKEN = 'artesania-debug-2026';

router.post('/fix-schema', async (req, res) => {
  const token = req.headers['x-debug-token'];
  if (token !== DEBUG_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const tables = [
    'hero_cards', 'site_texts', 'site_settings',
    'products', 'categories', 'orders', 'contacts',
    'reviews', 'testimonials', 'product_images',
    'subscribers', 'webhook_events', 'payment_config',
    'payment_proofs'
  ];

  const results = {};
  for (const table of tables) {
    try {
      const colExists = await query(
        "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenant_id'",
        [table]
      );
      if (colExists.rows[0].count > 0) {
        results[table] = 'already exists';
        continue;
      }
      await query(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT DEFAULT 'default'`);
      results[table] = 'created';
    } catch (err) {
      results[table] = 'error: ' + err.message;
    }
  }

  res.json({ ok: true, results });
});

module.exports = router;
