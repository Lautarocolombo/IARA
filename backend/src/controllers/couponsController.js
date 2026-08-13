const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getCoupons = async (req, res) => {
  try {
    const result = await query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo cupones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createCoupon = async (req, res) => {
  try {
    const { code, type, value, min_amount, max_uses, expires_at, active } = req.body || {};
    if (!code || !type || value === undefined) {
      return res.status(400).json({ error: 'Código, tipo y valor son requeridos' });
    }
    const result = await query(
      'INSERT INTO coupons (code, type, value, min_amount, max_uses, expires_at, active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [code, type, Number(value), Number(min_amount || 0), Number(max_uses || 0), expires_at || null, active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creando cupón:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code, type, value, min_amount, max_uses, expires_at, active } = req.body || {};
    const result = await query(
      'UPDATE coupons SET code = $1, type = $2, value = $3, min_amount = $4, max_uses = $5, expires_at = $6, active = $7 WHERE id = $8 RETURNING *',
      [code, type, Number(value), Number(min_amount || 0), Number(max_uses || 0), expires_at || null, active !== false, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cupón no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando cupón:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query('DELETE FROM coupons WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cupón no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando cupón:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const validateCoupon = async (req, res) => {
  try {
    const { code, amount } = req.body || {};
    if (!code || amount === undefined) {
      return res.status(400).json({ error: 'Código y monto son requeridos' });
    }
    const result = await query(
      'SELECT * FROM coupons WHERE code = $1 AND active = TRUE AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\')',
      [code]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cupón no encontrado o inactivo' });

    const coupon = result.rows[0];
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Cupón expirado' });
    }
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ error: 'Cupón agotado' });
    }
    if (Number(amount) < Number(coupon.min_amount)) {
      return res.status(400).json({ error: 'Monto mínimo no alcanzado para este cupón' });
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = Number(amount) * (Number(coupon.value) / 100);
    } else {
      discount = Number(coupon.value);
    }

    discount = Math.min(discount, Number(amount));

    res.json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount: discount,
      finalAmount: Number(amount) - discount
    });
  } catch (err) {
    logger.error('Error validando cupón:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon };
