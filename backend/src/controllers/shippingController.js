const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');

const getShippingDiff = async (req, res) => {
  try {
    const province = (req.query.province || '').trim();
    if (!province) {
      return res.status(400).json({ error: 'Provincia requerida' });
    }

    const configResult = await query('SELECT included_shipping_cost FROM payment_config LIMIT 1');
    const includedShippingCost = configResult.rows.length > 0 ? Number(configResult.rows[0].included_shipping_cost || 0) : 0;

    const rateResult = await query(
      'SELECT shipping_cost FROM shipping_rates_by_province WHERE province = $1',
      [province]
    );
    const shippingCost = rateResult.rows.length > 0 ? Number(rateResult.rows[0].shipping_cost || 0) : 0;

    const diff = Math.max(0, shippingCost - includedShippingCost);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      province,
      shipping_cost: shippingCost,
      included_shipping_cost: includedShippingCost,
      diff
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error en /api/shipping-diff');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getShippingRates = async (req, res) => {
  try {
    const result = await query('SELECT id, province, shipping_cost, updated_at FROM shipping_rates_by_province ORDER BY province ASC');
    res.json({ rates: result.rows });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo tarifas');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateShippingRates = async (req, res) => {
  try {
    const { rates } = req.body || {};
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'Se requiere un array de tarifas' });
    }
    await transaction(async (client) => {
      for (const rate of rates) {
        const province = String(rate.province || '').trim();
        const shippingCost = Number(rate.shipping_cost || 0);
        if (!province) continue;
        await query(
          'UPDATE shipping_rates_by_province SET shipping_cost = $1, updated_at = CURRENT_TIMESTAMP WHERE province = $2',
          [shippingCost, province],
          client
        );
      }
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error guardando tarifas');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getShippingDiff, getShippingRates, updateShippingRates };
