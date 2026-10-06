const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { getPublicUrl, deleteImageAsset, handleImageUpload, getTenantId } = require('../lib/imageService');
const { syncBus } = require('../routes/sync');
const { logAudit } = require('../lib/audit');
const { applyETag } = require('../lib/etag');

function mapRow(r, baseUrl) {
  return {
    id: r.id,
    slot: r.slot,
    nombre: r.nombre,
    precio: r.precio,
    imagen: getPublicUrl(r.imagen, baseUrl),
    emoji: r.emoji,
    orden: r.orden,
    activo: r.activo,
    titulo: r.titulo || '',
    subtitulo: r.subtitulo || '',
    descripcion: r.descripcion || '',
    cta_texto: r.cta_texto || '',
    cta_url: r.cta_url || '',
    tipo: r.tipo || 'hero'
  };
}

const getHeroCards = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    const result = await query('SELECT * FROM hero_cards WHERE tenant_id = $1 ORDER BY slot ASC, id ASC', [tenantId]);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
  } catch (err) {
    logger.error('Error obteniendo hero cards:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicHeroCards = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    const result = await query('SELECT * FROM hero_cards WHERE activo = TRUE AND tenant_id = $1 ORDER BY slot ASC, id ASC', [tenantId]);
    const mapped = result.rows.map(r => mapRow(r, baseUrl));
    logger.debug('[HeroCards] GET /hero-cards public count:', mapped.length, mapped.map(function(c) { return { slot: c.slot, imagen: c.imagen ? 'has-image' : 'empty' }; }));
    if (applyETag(req, res, mapped)) return;
    res.json(mapped);
  } catch (err) {
    logger.error('Error obteniendo hero cards públicos:', err);
    const debug = process.env.DEBUG_API_ERROR;
    res.status(500).json({ error: debug ? err.message : 'Error interno del servidor' });
  }
};

const getHeroCardBySlot = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const tenantId = getTenantId(req);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    const result = await query('SELECT * FROM hero_cards WHERE slot = $1 AND tenant_id = $2 LIMIT 1', [slot, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Card no encontrada' });
    res.json(mapRow(result.rows[0], baseUrl));
  } catch (err) {
    logger.error('Error obteniendo hero card por slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertHeroCard = async (req, res) => {
  try {
    const { nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot } = req.body || {};
    const id = req.params.id ? Number(req.params.id) : null;
    const tenantId = getTenantId(req);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    let imagenUrl = imagen || '';
    if (req.file) {
      imagenUrl = await handleImageUpload(req.file, baseUrl);
    }

    if (id) {
      await query(
        'UPDATE hero_cards SET nombre=$1, precio=$2, imagen=$3, emoji=$4, orden=$5, activo=$6, titulo=$7, subtitulo=$8, descripcion=$9, cta_texto=$10, cta_url=$11, slot=$12, tenant_id=$13 WHERE id=$14',
        [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', descripcion||'', cta_texto||'', cta_url||'', Number(slot)||0, tenantId, id]
      );
      logger.info({ heroCardId: id, slot }, 'upsertHeroCard: hero card actualizada');
    } else {
      const existing = await query('SELECT id FROM hero_cards WHERE slot = $1 AND tenant_id = $2', [Number(slot) || 0, tenantId]);
      if (existing.rows.length > 0) {
        await query(
          'UPDATE hero_cards SET nombre=$1, precio=$2, imagen=$3, emoji=$4, orden=$5, activo=$6, titulo=$7, subtitulo=$8, descripcion=$9, cta_texto=$10, cta_url=$11, tenant_id=$12 WHERE slot=$13',
          [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', descripcion||'', cta_texto||'', cta_url||'', tenantId, Number(slot) || 0]
        );
        logger.info({ slot, existingId: existing.rows[0].id }, 'upsertHeroCard: hero card actualizada por slot existente');
      } else {
        await query(
          'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
          [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', descripcion||'', cta_texto||'', cta_url||'', Number(slot) || 0, tenantId]
        );
        logger.info({ slot }, 'upsertHeroCard: hero card creada');
      }
    }
    const result = await query('SELECT * FROM hero_cards WHERE tenant_id = $1 ORDER BY slot ASC, id ASC', [tenantId]);
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
    try { syncBus.emit('hero_updated', {}); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: id ? 'update' : 'create',
      entityType: 'hero_card',
      entityId: id || result.rows[0]?.id || 0,
      details: `Hero card ${id ? 'actualizada' : 'creada'} slot ${Number(slot) || 0}`,
      ip: req.ip || '',
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error guardando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteHeroCard = async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = getTenantId(req);
  try {
    const existing = await query('SELECT imagen FROM hero_cards WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length > 0 && existing.rows[0].imagen) {
      await deleteImageAsset({ url: existing.rows[0].imagen });
    }
    const result = await query('DELETE FROM hero_cards WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Card no encontrada' });
    logger.info({ heroCardId: id }, 'deleteHeroCard: hero card eliminada');
    res.json({ ok: true });
    try { syncBus.emit('hero_updated', {}); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'delete',
      entityType: 'hero_card',
      entityId: id,
      details: 'Hero card eliminada',
      ip: req.ip || '',
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateHeroSlot = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const { titulo, subtitulo, descripcion, cta_texto, cta_url, imagen, activo } = req.body || {};
    const tenantId = getTenantId(req);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    let imagenUrl = imagen || '';
    if (req.file) {
      imagenUrl = await handleImageUpload(req.file, baseUrl);
    }
    const existing = await query('SELECT id FROM hero_cards WHERE slot = $1 AND tenant_id = $2', [slot, tenantId]);
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot, tipo, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
        ['', '', imagenUrl, '📿', slot || 0, activo !== false, titulo || '', subtitulo || '', descripcion || '', cta_texto || '', cta_url || '', slot, 'hero', tenantId]
      );
      logger.info({ slot }, 'updateHeroSlot: hero slot creado');
    } else {
      const fields = { titulo, subtitulo, descripcion, cta_texto, cta_url, activo };
      if (req.file || imagen !== undefined) fields.imagen = imagenUrl;
      const updates = Object.entries(fields).filter(([_, v]) => v !== undefined);
      if (updates.length > 0) {
        const setParts = [];
        const values = [];
        updates.forEach(([f, v], i) => {
          setParts.push(`${f} = $${i + 1}`);
          values.push(f === 'activo' ? v !== false : v);
        });
        values.push(existing.rows[0].id, tenantId);
        await query(`UPDATE hero_cards SET ${setParts.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING *`, values);
        logger.info({ slot, heroCardId: existing.rows[0].id, fields: updates.map(([f]) => f) }, 'updateHeroSlot: hero slot actualizado');
      }
    }
    const result = await query('SELECT * FROM hero_cards WHERE slot = $1 AND tenant_id = $2', [slot, tenantId]);
    res.json(mapRow(result.rows[0], baseUrl));
    try { syncBus.emit('hero_updated', { slot }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error actualizando hero slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteHeroSlotImage = async (req, res) => {
  const slot = Number(req.params.slot);
  const tenantId = getTenantId(req);
  try {
    const existing = await query('SELECT id, imagen FROM hero_cards WHERE slot = $1 AND tenant_id = $2', [slot, tenantId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Slot de hero no encontrado' });
    const oldImage = existing.rows[0].imagen;
    if (oldImage) {
      await deleteImageAsset({ url: oldImage });
    }
    await query('UPDATE hero_cards SET imagen = \'\' WHERE id = $1 AND tenant_id = $2', [existing.rows[0].id, tenantId]);
    logger.info({ slot, heroCardId: existing.rows[0].id }, 'deleteHeroSlotImage: imagen eliminada');
    res.json({ ok: true, message: 'Imagen eliminada' });
    try { syncBus.emit('hero_updated', { slot }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error eliminando imagen de hero slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const syncHeroCards = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    await query('DELETE FROM hero_cards WHERE tenant_id = $1', [tenantId]);
    const cards = req.body?.cards || [];
    for (const c of cards) {
      await query(
        'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [c.nombre||c.name||'', c.precio||c.price||'', c.imagen||c.image||'', c.emoji||'📿', Number(c.orden||c.index||0), c.activo!==false, c.titulo||'', c.subtitulo||'', c.descripcion||'', c.cta_texto||'', c.cta_url||'', Number(c.slot||0), tenantId]
      );
    }
    const result = await query('SELECT * FROM hero_cards WHERE tenant_id = $1 ORDER BY slot ASC, id ASC', [tenantId]);
    logger.info({ cardsCount: cards.length }, 'syncHeroCards: hero cards sincronizadas');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
    try { syncBus.emit('hero_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error sincronizando hero cards:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getHeroCards,
  getPublicHeroCards,
  getHeroCardBySlot,
  upsertHeroCard,
  updateHeroSlot,
  deleteHeroSlotImage,
  deleteHeroCard,
  syncHeroCards,
  processHeroImage: handleImageUpload
};