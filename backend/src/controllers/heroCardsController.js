const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { adminAuth } = require('../middleware/auth');

const getHeroCards = async (req, res) => {
  try {
    const result = await query('SELECT * FROM hero_cards WHERE activo = TRUE ORDER BY orden ASC, id ASC');
    const cards = result.rows.map(r => ({
      index: r.id,
      name: r.nombre,
      price: r.precio,
      image: r.imagen,
      emoji: r.emoji,
      orden: r.orden,
      activo: r.activo
    }));
    res.json(cards);
  } catch (err) {
    logger.error('Error obteniendo hero cards:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertHeroCard = async (req, res) => {
  try {
    const { nombre, precio, imagen, emoji, orden, activo } = req.body || {};
    const id = req.params.id ? Number(req.params.id) : null;
    if (id) {
      await query('UPDATE hero_cards SET nombre = $1, precio = $2, imagen = $3, emoji = $4, orden = $5, activo = $6 WHERE id = $7', [nombre || '', precio || '', imagen || '', emoji || '📿', Number(orden) || 0, activo !== false, id]);
    } else {
      await query('INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo) VALUES ($1, $2, $3, $4, $5, $6)', [nombre || '', precio || '', imagen || '', emoji || '📿', Number(orden) || 0, activo !== false]);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error guardando hero card:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const syncHeroCards = async (req, res) => {
  try {
    await query('DELETE FROM hero_cards');
    const cards = req.body?.cards || [];
    for (const c of cards) {
      await query('INSERT INTO hero_cards (nombre, precio, imagen, emoji, orden, activo) VALUES ($1, $2, $3, $4, $5, $6)', [c.name || '', c.price || '', c.image || '', c.emoji || '📿', Number(c.orden || c.index || 0), c.activo !== false]);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error sincronizando hero cards:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getHeroCards, upsertHeroCard, syncHeroCards };
