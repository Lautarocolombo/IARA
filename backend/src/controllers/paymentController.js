const mercadopago = require('mercadopago');
const logger = require('../lib/logger');

async function createPreference(req, res) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado en el servidor' });
    }

    mercadopago.configure({ access_token: accessToken });

    const body = req.body || {};
    const preference = {
      items: body.items || [],
      payer: body.payer || {},
      external_reference: body.external_reference || '',
      back_urls: body.back_urls || {},
      auto_return: body.auto_return || 'approved',
      shipment: body.shipment || {}
    };

    const result = await mercadopago.preferences.create(preference);
    res.status(201).json({
      id: result.body.id,
      init_point: result.body.init_point,
      sandbox_init_point: result.body.sandbox_init_point
    });
  } catch (err) {
    logger.error('Error creando preferencia MP:', err);
    res.status(500).json({ error: 'Error al crear la preferencia de pago' });
  }
}

module.exports = { createPreference };
