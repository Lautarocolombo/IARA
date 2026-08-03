const { query } = require('../lib/db');
const logger = require('../lib/logger');

const getActivityLog = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const result = await query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo activity_log:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getEntityActivity = async (req, res) => {
  const entityType = String(req.query.entity_type || '');
  const entityId = Number(req.query.entity_id || 0);
  if (!entityType) return res.json([]);
  try {
    const result = await query('SELECT * FROM activity_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC', [entityType, entityId]);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo actividad de entidad:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getActivityLog, getEntityActivity };
