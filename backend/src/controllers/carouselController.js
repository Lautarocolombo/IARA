const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { getPublicUrl, deleteImageAsset, processFile } = require('../lib/upload');
const { syncBus } = require('../routes/sync');

async function getCarouselSlots(req, res) {
  try {
    const tenantId = req.tenantId || 'default';
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query(
      'SELECT * FROM carousel_images WHERE tenant_id = $1 ORDER BY slot ASC',
      [tenantId]
    );
    const rows = result.rows || [];
    const slots = {};
    for (let i = 1; i <= 5; i++) {
      const row = rows.find(r => Number(r.slot) === i);
      if (row) {
        row.url = getPublicUrl(row.url, baseUrl);
        slots[i] = row;
      } else {
        slots[i] = null;
      }
    }
    res.json({ slots });
  } catch (err) {
    logger.error('Error obteniendo carrusel:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateCarouselSlot(req, res) {
  try {
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
      return res.status(400).json({ error: 'El slot debe ser un número entre 1 y 5' });
    }

    const tenantId = req.tenantId || 'default';

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }

    const existing = await query(
      'SELECT * FROM carousel_images WHERE slot = $1 AND tenant_id = $2',
      [slot, tenantId]
    );

    if (existing.rows.length > 0) {
      const old = existing.rows[0];
      await deleteImageAsset(old);
    }

    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const processed = await processFile(req.file, baseUrl);

    const altText = (req.body.alt_text || '').trim();
    const linkUrl = (req.body.link_url || '').trim();
    const caption = (req.body.caption || '').trim();
    const aboutGroup = Number(req.body.about_group || 0);

    const result = await query(
      `INSERT INTO carousel_images (slot, url, public_id, alt_text, link_url, caption, about_group, updated_at, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       ON CONFLICT (slot, tenant_id) DO UPDATE SET
         url = EXCLUDED.url,
         public_id = EXCLUDED.public_id,
         alt_text = EXCLUDED.alt_text,
         link_url = EXCLUDED.link_url,
         caption = EXCLUDED.caption,
         about_group = EXCLUDED.about_group,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [slot, processed.url, processed.public_id || processed.blobName || '', altText, linkUrl, caption, aboutGroup, tenantId]
    );

    const updated = result.rows[0];
    updated.url = getPublicUrl(updated.url, baseUrl);
    try { syncBus.emit('carousel_updated', { slot }); } catch (e) { /* noop */ }
    res.json(updated);
  } catch (err) {
    logger.error('Error actualizando slot de carrusel:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateCarouselSlotMeta(req, res) {
  try {
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
      return res.status(400).json({ error: 'El slot debe ser un número entre 1 y 5' });
    }

    const tenantId = req.tenantId || 'default';
    const altText = (req.body.alt_text || '').trim();
    const linkUrl = (req.body.link_url || '').trim();
    const caption = (req.body.caption || '').trim();
    const aboutGroup = Number(req.body.about_group || 0);

    const existing = await query(
      'SELECT * FROM carousel_images WHERE slot = $1 AND tenant_id = $2',
      [slot, tenantId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE carousel_images SET alt_text=$1, link_url=$2, caption=$3, about_group=$4, updated_at=NOW() WHERE slot=$5 AND tenant_id=$6 RETURNING *`,
        [altText, linkUrl, caption, aboutGroup, slot, tenantId]
      );
    } else {
      result = await query(
        `INSERT INTO carousel_images (slot, url, public_id, alt_text, link_url, caption, about_group, updated_at, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING *`,
        [slot, '', '', altText, linkUrl, caption, aboutGroup, tenantId]
      );
    }

    const updated = result.rows[0];
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    updated.url = getPublicUrl(updated.url, baseUrl);
    try { syncBus.emit('carousel_updated', { slot }); } catch (e) { /* noop */ }
    res.json(updated);
  } catch (err) {
    logger.error('Error actualizando meta de carrusel:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteCarouselSlot(req, res) {
  try {
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
      return res.status(400).json({ error: 'El slot debe ser un número entre 1 y 5' });
    }

    const tenantId = req.tenantId || 'default';
    const existing = await query(
      'SELECT * FROM carousel_images WHERE slot = $1 AND tenant_id = $2',
      [slot, tenantId]
    );

    if (existing.rows.length > 0) {
      await deleteImageAsset(existing.rows[0]);
      await query('DELETE FROM carousel_images WHERE slot = $1 AND tenant_id = $2', [slot, tenantId]);
    }

    try { syncBus.emit('carousel_updated', { slot }); } catch (e) { /* noop */ }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando slot de carrusel:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  getCarouselSlots,
  updateCarouselSlot,
  updateCarouselSlotMeta,
  deleteCarouselSlot
};
