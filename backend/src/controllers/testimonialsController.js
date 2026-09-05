const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { saveUploadedFile, deleteImageAsset, getPublicUrl } = require('../lib/upload');
const { syncBus } = require('../routes/sync');
const { testimonialSchema } = require('../lib/validators');
const { logAudit } = require('../lib/audit');
const { applyETag } = require('../lib/etag');

const ALLOWED_TESTIMONIAL_COLUMNS = ['name', 'comment', 'rating', 'image', 'avatar', 'active', 'orden', 'role', 'product_image_url'];

const getPublicTestimonials = async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials WHERE active = TRUE ORDER BY orden ASC, created_at DESC');
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || '';
    const rows = result.rows.map((row) => ({
      ...row,
      image: getPublicUrl(row.image, baseUrl),
      avatar: getPublicUrl(row.avatar, baseUrl),
      product_image_url: getPublicUrl(row.product_image_url, baseUrl)
    }));
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
  let { name, comment, rating = 5, image = '', product_image_url = '', active = true, orden = 0, removeImage, removeProductImage } = req.body || {};
  if (req.files && req.files.image && req.files.image[0]) {
    image = await saveUploadedFile(req.files.image[0]);
  }
  if (req.files && req.files.productImage && req.files.productImage[0]) {
    product_image_url = await saveUploadedFile(req.files.productImage[0]);
  } else if (req.file && req.file.fieldname === 'productImage') {
    product_image_url = await saveUploadedFile(req.file);
  }
  if (removeImage === 'true' || removeImage === true) {
    image = '';
  }
  if (removeProductImage === 'true' || removeProductImage === true) {
    product_image_url = '';
  }
  const parsed = testimonialSchema.safeParse({ name, comment, rating, image, active });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
  }
  const { name: safeName, comment: safeComment, rating: safeRating } = parsed.data;
  try {
    const result = await query(
      'INSERT INTO testimonials (name, comment, rating, image, avatar, active, orden, product_image_url, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING *',
      [safeName, safeComment, Number(safeRating), image, image, active !== false, Number(orden), product_image_url || '']
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
  if (req.files && req.files.image && req.files.image[0]) {
    updates.image = await saveUploadedFile(req.files.image[0]);
  }
  if (req.files && req.files.productImage && req.files.productImage[0]) {
    updates.product_image_url = await saveUploadedFile(req.files.productImage[0]);
  } else if (req.file && req.file.fieldname === 'productImage') {
    updates.product_image_url = await saveUploadedFile(req.file);
  }
  if (updates.removeImage === 'true' || updates.removeImage === true) {
    updates.image = '';
    delete updates.removeImage;
  }
  if (updates.removeProductImage === 'true' || updates.removeProductImage === true) {
    updates.product_image_url = '';
    delete updates.removeProductImage;
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
    const existing = await query('SELECT * FROM testimonials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    if (existing.rows[0].image) {
      await deleteImageAsset(existing.rows[0]);
    }
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

const uploadTestimonialImage = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    if (existing.rows[0].image) {
      await deleteImageAsset(existing.rows[0]);
    }
    const imageUrl = await saveUploadedFile(req.file);
    const result = await query(
      'UPDATE testimonials SET image = $1, avatar = $1, tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id = $2 RETURNING *',
      [imageUrl, id]
    );
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'upload_image',
      entityType: 'testimonial',
      entityId: id,
      details: 'Imagen de testimonio subida',
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error subiendo imagen de testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteTestimonialImage = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    if (existing.rows[0].image) {
      await deleteImageAsset(existing.rows[0]);
    }
    const result = await query(
      'UPDATE testimonials SET image = \'\', avatar = \'\', tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'delete_image',
      entityType: 'testimonial',
      entityId: id,
      details: 'Imagen de testimonio eliminada',
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando imagen de testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const uploadTestimonialProductImage = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    if (existing.rows[0].product_image_url) {
      await deleteImageAsset({ url: existing.rows[0].product_image_url });
    }
    const imageUrl = await saveUploadedFile(req.file);
    const result = await query(
      'UPDATE testimonials SET product_image_url = $1, tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id = $2 RETURNING *',
      [imageUrl, id]
    );
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'upload_product_image',
      entityType: 'testimonial',
      entityId: id,
      details: 'Imagen de producto en uso subida',
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error subiendo imagen de producto del testimonio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteTestimonialProductImage = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await query('SELECT * FROM testimonials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Testimonio no encontrado' });
    }
    if (existing.rows[0].product_image_url) {
      await deleteImageAsset({ url: existing.rows[0].product_image_url });
    }
    const result = await query(
      'UPDATE testimonials SET product_image_url = \'\', tenant_id = COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\') WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
    try { syncBus.emit('testimonials_updated', { id }); } catch (e) { /* noop */ }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'delete_product_image',
      entityType: 'testimonial',
      entityId: id,
      details: 'Imagen de producto en uso eliminada',
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando imagen de producto del testimonio:', err);
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
  deleteTestimonialImage,
  uploadTestimonialProductImage,
  deleteTestimonialProductImage
};