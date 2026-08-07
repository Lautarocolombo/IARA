const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { getPublicUrl, deleteImageAsset, saveUploadedFile } = require('../lib/upload');

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
    cta_texto: r.cta_texto || '',
    cta_url: r.cta_url || '',
    tipo: r.tipo || 'hero'
  };
}

const getHeroCards = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM hero_cards ORDER BY slot ASC, id ASC');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
  } catch (err) {
    logger.error('Error obteniendo hero cards:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicHeroCards = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM hero_cards WHERE activo = TRUE ORDER BY slot ASC, id ASC');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
  } catch (err) {
    logger.error('Error obteniendo hero cards públicos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getHeroCardBySlot = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query('SELECT * FROM hero_cards WHERE slot = $1 LIMIT 1', [slot]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Card no encontrada' });
    res.json(mapRow(result.rows[0], baseUrl));
  } catch (err) {
    logger.error('Error obteniendo hero card por slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertHeroCard = async (req, res) => {
  try {
    const { nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot } = req.body || {};
    const id = req.params.id ? Number(req.params.id) : null;
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    let imagenUrl = imagen || '';
    if (req.file) {
      imagenUrl = await saveUploadedFile(req.file);
    }

    if (id) {
      await query(
        'UPDATE hero_cards SET nombre=$1, precio=$2, imagen=$3, emoji=$4, orden=$5, activo=$6, titulo=$7, subtitulo=$8, cta_texto=$9, cta_url=$10, slot=$11 WHERE id=$12',
        [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', cta_texto||'', cta_url||'', Number(slot)||0, id]
      );
    } else {
      const existing = await query('SELECT id FROM hero_cards WHERE slot = $1', [Number(slot) || 0]);
      if (existing.rows.length > 0) {
        await query(
          'UPDATE hero_cards SET nombre=$1, precio=$2, imagen=$3, emoji=$4, orden=$5, activo=$6, titulo=$7, subtitulo=$8, cta_texto=$9, cta_url=$10 WHERE slot=$11',
          [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', cta_texto||'', cta_url||'', Number(slot) || 0]
        );
      } else {
        await query(
          'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [nombre||'', precio||'', imagenUrl, emoji||'📿', Number(orden)||0, activo!==false, titulo||'', subtitulo||'', cta_texto||'', cta_url||'', Number(slot) || 0]
        );
      }
    }
    const result = await query('SELECT * FROM hero_cards ORDER BY slot ASC, id ASC');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
  } catch (err) {
    logger.error('Error guardando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteHeroCard = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM hero_cards WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Card no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateHeroSlot = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const { titulo, subtitulo, cta_texto, cta_url, imagen, activo } = req.body || {};
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    let imagenUrl = imagen || '';
    if (req.file) {
      imagenUrl = await saveUploadedFile(req.file);
    }
    const existing = await query('SELECT id FROM hero_cards WHERE slot = $1', [slot]);
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot, tipo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        ['', '', imagenUrl, '📿', slot || 0, activo !== false, titulo || '', subtitulo || '', cta_texto || '', cta_url || '', slot, 'hero']
      );
    } else {
      const fields = { titulo, subtitulo, cta_texto, cta_url, activo };
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
        await query(`UPDATE hero_cards SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
      }
    }
    const result = await query('SELECT * FROM hero_cards WHERE slot = $1', [slot]);
    res.json(mapRow(result.rows[0], baseUrl));
  } catch (err) {
    logger.error('Error actualizando hero slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteHeroSlotImage = async (req, res) => {
  const slot = Number(req.params.slot);
  try {
    const existing = await query('SELECT id, imagen FROM hero_cards WHERE slot = $1', [slot]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Slot de hero no encontrado' });
    const oldImage = existing.rows[0].imagen;
    if (oldImage) {
      await deleteImageAsset({ url: oldImage, filename: oldImage.split('/').pop() });
    }
    await query('UPDATE hero_cards SET imagen = \'\' WHERE id = $1', [existing.rows[0].id]);
    res.json({ ok: true, message: 'Imagen eliminada' });
  } catch (err) {
    logger.error('Error eliminando imagen de hero slot:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const syncHeroCards = async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    await query('DELETE FROM hero_cards');
    const cards = req.body?.cards || [];
    for (const c of cards) {
      await query(
        'INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [c.nombre||c.name||'', c.precio||c.price||'', c.imagen||c.image||'', c.emoji||'📿', Number(c.orden||c.index||0), c.activo!==false, c.titulo||'', c.subtitulo||'', c.cta_texto||'', c.cta_url||'', Number(c.slot||0)]
      );
    }
    const result = await query('SELECT * FROM hero_cards ORDER BY slot ASC, id ASC');
    res.json(result.rows.map(r => mapRow(r, baseUrl)));
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
  syncHeroCards
};
