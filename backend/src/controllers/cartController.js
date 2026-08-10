const { query } = require('../lib/db');
const logger = require('../lib/logger');

const generateSessionToken = () => {
  return 'cart_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
};

const resolveSessionToken = (req) => {
  const header = req.headers['x-session-token'];
  const queryToken = req.query.session_token;
  const bodyToken = req.body && req.body.session_token;
  return header || queryToken || bodyToken || null;
};

const getOrCreateSession = async (req, res) => {
  try {
    let token = resolveSessionToken(req);
    if (!token) {
      token = generateSessionToken();
    }

    let row = null;
    try {
      const result = await query('SELECT * FROM cart_sessions WHERE session_token = $1', [token]);
      row = result.rows[0] || null;
    } catch (err) {
      logger.debug({ err: err.message }, 'Error consultando cart_sessions');
    }

    if (!row) {
      logger.debug('getOrCreateSession: creando sesion');
      await query('INSERT INTO cart_sessions (session_token, items) VALUES ($1, $2)', [token, JSON.stringify({})]);
      const result = await query('SELECT * FROM cart_sessions WHERE session_token = $1', [token]);
      row = result.rows[0];
    }

    const items = typeof row.items === 'string' ? JSON.parse(row.items || '{}') : (row.items || {});
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({ sessionToken: token, items });
  } catch (err) {
    logger.error('Error en getOrCreateSession:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCartItems = async (req, res) => {
  try {
    const { session_token, items } = req.body || {};
    if (!session_token) {
      return res.status(400).json({ error: 'session_token es requerido' });
    }
    const result = await query(
      'UPDATE cart_sessions SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE session_token = $2',
      [JSON.stringify(items || {}), session_token]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    res.json({ ok: true, items: items || {} });
  } catch (err) {
    logger.error('Error en updateCartItems:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const addCartItem = async (req, res) => {
  try {
    const { session_token, product_id, name, price, qty, emoji, image } = req.body || {};
    if (!session_token || !product_id) {
      return res.status(400).json({ error: 'session_token y product_id son requeridos' });
    }
    const result = await query('SELECT * FROM cart_sessions WHERE session_token = $1', [session_token]);
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    const items = typeof row.items === 'string' ? JSON.parse(row.items || '{}') : (row.items || {});
    const key = String(product_id);
    const existing = items[key] || { qty: 0 };
    items[key] = {
      id: product_id,
      name: name || existing.name || '',
      price: Number(price || existing.price || 0),
      qty: Number((existing.qty || 0) + (qty || 1)),
      emoji: emoji || existing.emoji || '📿',
      image: image || existing.image || ''
    };
    if (items[key].qty <= 0) delete items[key];
    await query('UPDATE cart_sessions SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE session_token = $2', [JSON.stringify(items), session_token]);
    res.json({ ok: true, items });
  } catch (err) {
    logger.error('Error en addCartItem:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { session_token, product_id } = req.body || {};
    if (!session_token || !product_id) {
      return res.status(400).json({ error: 'session_token y product_id son requeridos' });
    }
    const result = await query('SELECT * FROM cart_sessions WHERE session_token = $1', [session_token]);
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    const items = typeof row.items === 'string' ? JSON.parse(row.items || '{}') : (row.items || {});
    delete items[String(product_id)];
    await query('UPDATE cart_sessions SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE session_token = $2', [JSON.stringify(items), session_token]);
    res.json({ ok: true, items });
  } catch (err) {
    logger.error('Error en removeCartItem:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const clearCart = async (req, res) => {
  try {
    const { session_token } = req.body || {};
    if (!session_token) {
      return res.status(400).json({ error: 'session_token es requerido' });
    }
    await query('UPDATE cart_sessions SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE session_token = $2', [JSON.stringify({}), session_token]);
    res.json({ ok: true, items: {} });
  } catch (err) {
    logger.error('Error en clearCart:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOrCreateSession, updateCartItems, addCartItem, removeCartItem, clearCart, generateSessionToken, resolveSessionToken };
