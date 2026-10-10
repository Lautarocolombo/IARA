const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { deleteImageAsset, getPublicUrl, handleImageUpload, clearImageField, deleteOldAndSetNew, getTenantId } = require('../lib/imageService');
const { syncBus } = require('../routes/sync');
const { testimonialSchema } = require('../lib/validators');
const { logAudit } = require('../lib/audit');
const { applyETag } = require('../lib/etag');

const ALLOWED_TESTIMONIAL_COLUMNS = ['name', 'comment', 'rating', 'image', 'avatar', 'active', 'orden', 'role', 'product_image_url'];
const IMAGE_COLUMNS = ['image', 'avatar', 'product_image_url'];

const getPublicTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials WHERE active = TRUE ORDER BY orden ASC, created_at DESC');
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    const rows = result.rows.map((row) => {
      var resolvedImage = getPublicUrl(row.image, baseUrl);
      if (!resolvedImage && row.product_image_url) {
        resolvedImage = getPublicUrl(row.product_image_url, baseUrl);
      }
      var altText = 'Pulsera de Artesan\u00edas Gualeguay, foto de ' + (row.name || 'cliente');
      return {
        ...row,
        image: resolvedImage,
        avatar: getPublicUrl(row.avatar, baseUrl),
        product_image_url: getPublicUrl(row.product_image_url, baseUrl),
        alt: altText
      };
    });
    if (applyETag(req, res, rows)) return;
    res.json(rows);
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
  let { name, comment, rating = 5, image = '', active = true, orden = 0, removeImage } = req.body || {};
  if (req.files && req.files.image && req.files.image[0]) {
    image = await handleImageUpload(req.files.image[0]);
  }
  if (removeImage === 'true' || removeImage === true) {
    image = '';
  }
  const parsed = testimonialSchema.safeParse({ name, comment, rating, image, active });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inv\u00e1lidos' });
  }
  const { name: safeName, comment: safeComment, rating: safeRating } = parsed.data;
  const tenantId = getTenantId(req);
  try {
    const result = await query(
      'INSERT INTO testimonials (name, comment, rating, image, avatar, active, orden, product_image_url, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [safeName, safeComment, Number(safeRating), image, image, active !== false, Number(orden), '', tenantId]
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
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error creando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toggleTestimonialActive = async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  const tenantId = getTenantId(req);
  try {
    const result = await query(
      'UPDATE testimonials SET active = $1, tenant_id = $2 WHERE id = $3 RETURNING *',
      [active !== false, tenantId, id]
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
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error actualizando estado del testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateTestimonialOrder = async (req, res) => {
  const { orden } = req.body || {};
  if (!Array.isArray(orden)) return res.status(400).json({ error: 'Se requiere un array de \u00f3rdenes' });
  const tenantId = getTenantId(req);
  try {
    for (const item of orden) {
      if (item.id !== undefined && item.orden !== undefined) {
        await query('UPDATE testimonials SET orden = $1, tenant_id = $2 WHERE id = $3', [Number(item.orden), tenantId, Number(item.id)]);
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
  const tenantId = getTenantId(req);

  if (req.files && req.files.image && req.files.image[0]) {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length > 0) {
      await deleteOldAndSetNew('testimonials', 'id', id, IMAGE_COLUMNS, await handleImageUpload(req.files.image[0]), tenantId);
    }
  }
  if (updates.removeImage === 'true' || updates.removeImage === true) {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length > 0) {
      for (const col of IMAGE_COLUMNS) {
        if (existing.rows[0][col]) {
          await deleteImageAsset({ url: existing.rows[0][col] });
        }
      }
    }
    await clearImageField('testimonials', 'id', id, 'image', tenantId);
    await clearImageField('testimonials', 'id', id, 'avatar', tenantId);
    await clearImageField('testimonials', 'id', id, 'product_image_url', tenantId);
    delete updates.removeImage;
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
  if (fields.includes('active')) {
    const val = updates.active;
    updates.active = val !== false && val !== 'false' && val !== '0' && val !== 0;
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
  values.push(id, tenantId);
  try {
    const result = await query(`UPDATE testimonials SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING *`, values);
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
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error actualizando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteTestimonial = async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = getTenantId(req);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    for (const col of IMAGE_COLUMNS) {
      if (existing.rows[0][col]) {
        await deleteImageAsset({ url: existing.rows[0][col] });
      }
    }
    const result = await query('DELETE FROM testimonials WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
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
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const uploadTestimonialImage = async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = getTenantId(req);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibi\u00f3 imagen' });
    }
    const imageUrl = await handleImageUpload(req.file);
    await deleteOldAndSetNew('testimonials', 'id', id, IMAGE_COLUMNS, imageUrl, tenantId);
    const result = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'upload_image',
      entityType: 'testimonial',
      entityId: id,
      details: 'Imagen de producto en uso subida',
      ip: req.ip || '',
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error subiendo imagen de testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteTestimonialImage = async (req, res) => {
  const id = Number(req.params.id);
  const tenantId = getTenantId(req);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    for (const col of IMAGE_COLUMNS) {
      if (existing.rows[0][col]) {
        await deleteImageAsset({ url: existing.rows[0][col] });
      }
    }
    await clearImageField('testimonials', 'id', id, 'image', tenantId);
    await clearImageField('testimonials', 'id', id, 'avatar', tenantId);
    await clearImageField('testimonials', 'id', id, 'product_image_url', tenantId);
    const result = await query('SELECT * FROM testimonials WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'delete_image',
      entityType: 'testimonial',
      entityId: id,
      details: 'Imagen de producto en uso eliminada',
      ip: req.ip || '',
      tenantId
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando imagen de testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getPublicTestimonials,
  getAdminTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialActive,
  updateTestimonialOrder,
  reorderTestimonials,
  uploadTestimonialImage,
  deleteTestimonialImage
};