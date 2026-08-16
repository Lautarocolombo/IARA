const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { getPublicUrl, deleteImageAsset, processFile } = require('../lib/upload');
const { syncBus } = require('../routes/sync');

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

async function processHeroImage(file, baseUrl) {
  const processed = await processFile(file, baseUrl);
  return getPublicUrl(processed.url, baseUrl);
}

const getHeroCards = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM hero_cards WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') ORDER BY slot ASC, id ASC');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
  } catch (err) {
    logger.error('Error obteniendo hero cards:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicHeroCards = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM hero_cards WHERE activo = TRUE AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') ORDER BY slot ASC, id ASC');
    const mapped = result.rows.map(r => mapRow(r, baseUrl));
    console.log('[HeroCards] GET /hero-cards public count:', mapped.length, mapped.map(function(c) { return { slot: c.slot, imagen: c.imagen ? 'has-image' : 'empty' }; }));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM hero_cards WHERE slot = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') LIMIT 1', [slot]);
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
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    let imagenUrl = imagen || '';
    if (req.file) {
      imagenUrl = await processHeroImage(req.file, baseUrl);
    }

    if (id) {
      await query(
        'UPDATE hero_cards SET nombre=$1, precio=$2, imagen=$3, emoji=$4, orden=$5, activo=$6, titulo=$7, subtitulo=$8, descripcion=$9, cta_texto=$10, cta_url=$11, slot=$12, tenant_id=COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id=$13',
        [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', descripcion||'', cta_texto||'', cta_url||'', Number(slot)||0, id]
      );
      logger.info({ heroCardId: id, slot }, 'upsertHeroCard: hero card actualizada');
    } else {
      const existing = await query('SELECT id FROM hero_cards WHERE slot = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')', [Number(slot) || 0]);
      if (existing.rows.length > 0) {
        await query(
          'UPDATE hero_cards SET nombre=$1, precio=$2, imagen=$3, emoji=$4, orden=$5, activo=$6, titulo=$7, subtitulo=$8, descripcion=$9, cta_texto=$10, cta_url=$11, tenant_id=COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE slot=$12',
          [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', descripcion||'', cta_texto||'', cta_url||'', Number(slot) || 0]
        );
        logger.info({ slot, existingId: existing.rows[0].id }, 'upsertHeroCard: hero card actualizada por slot existente');
      } else {
        await query(
          'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
          [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', descripcion||'', cta_texto||'', cta_url||'', Number(slot) || 0]
        );
        logger.info({ slot }, 'upsertHeroCard: hero card creada');
      }
    }
    const result = await query('SELECT * FROM hero_cards WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') ORDER BY slot ASC, id ASC');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
    try { syncBus.emit('hero_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error guardando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteHeroCard = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM hero_cards WHERE id = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Card no encontrada' });
    logger.info({ heroCardId: id }, 'deleteHeroCard: hero card eliminada');
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateHeroSlot = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const { titulo, subtitulo, descripcion, cta_texto, cta_url, imagen, activo } = req.body || {};
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    let imagenUrl = imagen || '';
    if (req.file) {
      imagenUrl = await processHeroImage(req.file, baseUrl);
    }
    const existing = await query('SELECT id FROM hero_cards WHERE slot = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')', [slot]);
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot, tipo, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
        ['', '', imagenUrl, '📿', slot || 0, activo !== false, titulo || '', subtitulo || '', descripcion || '', cta_texto || '', cta_url || '', slot, 'hero']
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
        values.push(existing.rows[0].id);
        await query(`UPDATE hero_cards SET ${setParts.join(', ')} WHERE id = $${values.length} AND tenant_id = COALESCE(current_setting('app.current_tenant', TRUE), 'default') RETURNING *`, values);
        logger.info({ slot, heroCardId: existing.rows[0].id, fields: updates.map(([f]) => f) }, 'updateHeroSlot: hero slot actualizado');
      }
    }
    const result = await query('SELECT * FROM hero_cards WHERE slot = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')', [slot]);
    res.json(mapRow(result.rows[0], baseUrl));
    try { syncBus.emit('hero_updated', { slot }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error actualizando hero slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteHeroSlotImage = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const existing = await query('SELECT id, imagen FROM hero_cards WHERE slot = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')', [slot]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Slot de hero no encontrado' });
    const oldImage = existing.rows[0].imagen;
    if (oldImage) {
      await deleteImageAsset({ url: oldImage, filename: oldImage.split('/').pop() });
    }
    await query('UPDATE hero_cards SET imagen = \'\' WHERE id = $1', [existing.rows[0].id]);
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
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    await query('DELETE FROM hero_cards WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')');
    const cards = req.body?.cards || [];
    for (const c of cards) {
      await query(
        'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, descripcion, cta_texto, cta_url, slot, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\'))',
        [c.nombre||c.name||'', c.precio||c.price||'', c.imagen||c.image||'', c.emoji||'📿', Number(c.orden||c.index||0), c.activo!==false, c.titulo||'', c.subtitulo||'', c.descripcion||'', c.cta_texto||'', c.cta_url||'', Number(c.slot||0)]
      );
    }
    const result = await query('SELECT * FROM hero_cards WHERE tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') ORDER BY slot ASC, id ASC');
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
  processHeroImage
};

