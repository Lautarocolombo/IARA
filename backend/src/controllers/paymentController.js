const logger = require('../lib/logger');

async function createPreference(req, res) {
  logger.warn('Solicitud a /api/create-preference rechazada: el pago manual por alias y WhatsApp está habilitado.');
  return res.status(501).json({
    error: 'Endpoint deshabilitado. El checkout utiliza pago manual por alias de transferencia y comprobante por WhatsApp.'
  });
}

module.exports = { createPreference };
