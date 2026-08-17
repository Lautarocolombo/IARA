const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { syncBus } = require('../routes/sync');
const { sectionContentSchema } = require('../lib/validators');

const getSectionContent = async (req, res) => {
  try {
    const { sectionKey } = req.params;
    const result = await query(
      'SELECT section_key, title, subtitle, updated_at FROM section_content WHERE section_key = $1 AND tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')',
      [sectionKey]
    );
    if (result.rows.length === 0) {
      return res.json({ section_key: sectionKey, title: '', subtitle: '', updated_at: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error obteniendo contenido de sección:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertSectionContent = async (req, res) => {
  try {
    const { sectionKey } = req.params;
    const body = req.body || {};
    const parsed = sectionContentSchema.safeParse({ ...body, sectionKey });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
    }
    const { title, subtitle } = parsed.data;
    const result = await query(
      'INSERT INTO section_content (section_key, title, subtitle, tenant_id) VALUES ($1, $2, $3, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) ON CONFLICT (section_key) DO UPDATE SET title = $2, subtitle = $3, updated_at = CURRENT_TIMESTAMP, tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') RETURNING *',
      [sectionKey, title, subtitle]
    );
    try { syncBus.emit('section_content_updated', { sectionKey }); } catch (e) { /* noop */ }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error guardando contenido de sección:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSectionContent, upsertSectionContent };
