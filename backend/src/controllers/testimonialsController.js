const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { saveUploadedFile } = require('../lib/upload');
const { syncBus } = require('../routes/sync');
const { testimonialSchema } = require('../lib/validators');
const { logAudit } = require('../lib/audit');
const { applyETag } = require('../lib/etag');

const ALLOWED_TESTIMONIAL_COLUMNS = ['name', 'comment', 'rating', 'image', 'avatar', 'active', 'orden', 'role'];

const getPublicTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials WHERE active = TRUE ORDER BY orden ASC, created_at DESC');
    if (applyETag(req, res, result.rows)) return;
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo testimonios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials ORDER BY orden ASC, created_at DESC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error obteniendo testimonios (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createTestimonial = async (req, res) => {
  let { name, comment, rating = 5, image = '', active = true, orden = 0 } = req.body || {};
  if (req.file) {
    image = await saveUploadedFile(req.file);
  }
  const parsed = testimonialSchema.safeParse({ name, comment, rating, image, active });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
  }
  const { name: safeName, comment: safeComment, rating: safeRating } = parsed.data;
  try {
    const result = await query(
      'INSERT INTO testimonials (name, comment, rating, image, avatar, active, orden, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING *',
      [safeName, safeComment, Number(safeRating), image, image, active !== false, Number(orden)]
    );
    res.status(201).json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id: result.rows[0].id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'create',
      entityType: 'testimonial',
      entityId: result.rows[0].id,
      details: `Testimonio creado: ${safeName}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error creando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toggleTestimonialActive = async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  try {
    const result = await query(
      'UPDATE testimonials SET active = $1, tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id = $2 RETURNING *',
      [active !== false, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'toggle_status',
      entityType: 'testimonial',
      entityId: id,
      details: `Testimonio ${active !== false ? 'activado' : 'desactivado'}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error actualizando estado del testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateTestimonialOrder = async (req, res) => {
  const { orden } = req.body || {};
  if (!Array.isArray(orden)) return res.status(400).json({ error: 'Se requiere un array de órdenes' });
  try {
    for (const item of orden) {
      if (item.id !== undefined && item.orden !== undefined) {
        await query('UPDATE testimonials SET orden = $1, tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id = $2', [Number(item.orden), Number(item.id)]);
      }
    }
    res.json({ ok: true });
    try { syncBus.emit('testimonials_updated', {}); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error('Error actualizando orden de testimonios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const reorderTestimonials = updateTestimonialOrder;

const updateTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body || {};
  if (req.file) {
    updates.image = await saveUploadedFile(req.file);
  }
  const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED_TESTIMONIAL_COLUMNS.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  if (fields.includes('name')) {
    const name = String(updates.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });
    if (name.length > 100) return res.status(400).json({ error: 'Nombre no puede superar 100 caracteres' });
    updates.name = name;
  }
  if (fields.includes('comment')) {
    const comment = String(updates.comment || '').trim();
    if (!comment) return res.status(400).json({ error: 'Comentario es requerido' });
    if (comment.length > 500) return res.status(400).json({ error: 'Comentario no puede superar 500 caracteres' });
    updates.comment = comment;
  }
  const values = [];
  const setParts = [];
  fields.forEach((f, i) => {
    if (f === 'image') {
      setParts.push(`image = $${i + 1}`, `avatar = $${i + 1}`);
      values.push(updates[f]);
    } else {
      setParts.push(`${f} = $${i + 1}`);
      values.push(f === 'rating' ? Number(updates[f]) : updates[f]);
    }
  });
  values.push(id);
  try {
    const result = await query(`UPDATE testimonials SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'update',
      entityType: 'testimonial',
      entityId: id,
      details: `Testimonio actualizado: ${fields.join(', ')}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error actualizando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Testimonio no encontrado' });
    res.json({ ok: true });
    try { syncBus.emit('testimonials_updated', { id: Number(req.params.id) }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'delete',
      entityType: 'testimonial',
      entityId: id,
      details: 'Testimonio eliminado',
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getPublicTestimonials, getAdminTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, toggleTestimonialActive, updateTestimonialOrder, reorderTestimonials };
