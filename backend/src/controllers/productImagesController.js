const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { getPublicUrl, deleteImageAsset, processFile } = require('../lib/upload');
const { logAudit } = require('../lib/audit');
const { applyETag } = require('../lib/etag');

async function getProductImages(req, res) {
  try {
    const productId = Number(req.params.id);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const result = await query(
      'SELECT * FROM product_images WHERE product_id =$1 ORDER BY orden ASC, id ASC',
      [productId]
    );
    const images = result.rows.map(img => ({
      ...img,
      url: getPublicUrl(img.url, baseUrl)
    }));
    if (applyETag(req, res, images)) return;
    res.json(images);
  } catch (err) {
    logger.error('Error obteniendo imágenes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function uploadProductImages(req, res) {
  try {
    const productId = Number(req.params.id);
    const productCheck = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const existingImages = await query(
      'SELECT MAX(orden) as max_orden FROM product_images WHERE product_id = $1',
      [productId]
    );
    const startOrden = (existingImages.rows[0]?.max_orden ?? -1) + 1;

    const uploaded = [];
    const imageUrls = [];
    if (req.body.imageUrls) {
      try {
        const parsed = JSON.parse(req.body.imageUrls);
        if (Array.isArray(parsed)) {
          imageUrls.push(...parsed);
        }
      } catch (e) {
        // ignore parse error
      }
    }

    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const result = await query(
        'INSERT INTO product_images (product_id, url, filename, cloudinary_public_id, orden, es_principal, descripcion, categoria, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING *',
        [productId, url, '', '', startOrden + i, false, req.body.descripcion || '', req.body.categoria || '']
      );
      uploaded.push({
        ...result.rows[0],
        url: getPublicUrl(result.rows[0].url, baseUrl)
      });
    }

     if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const processed = await processFile(file, baseUrl);
        const publicUrl = getPublicUrl(processed.url, baseUrl);
        if (!publicUrl) {
          logger.error({ filename: processed.filename, isBlob: processed.isBlob }, 'Imagen procesada pero URL pública vacía');
        }
        const result = await query(
          'INSERT INTO product_images (product_id, url, filename, cloudinary_public_id, orden, es_principal, descripcion, categoria, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING *',
          [productId, processed.url, processed.filename, processed.cloudinary_public_id || '', startOrden + imageUrls.length + i, false, req.body.descripcion || '', req.body.categoria || '']
        );
        uploaded.push({
          ...result.rows[0],
          url: publicUrl
        });
      }
    }

    res.status(201).json({ ok: true, images: uploaded });

    if (uploaded.length > 0) {
      const mainUrl = uploaded[0].url;
      await query('UPDATE products SET image = $1 WHERE id = $2', [mainUrl, productId]);
    }
    logAudit({
      user: req.user?.user || 'admin',
      action: 'upload',
      entityType: 'product_image',
      entityId: productId,
      details: `${uploaded.length} imágenes subidas para producto ${productId}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error({ err: err.message }, 'Error subiendo imágenes');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateProductImage(req, res) {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const { es_principal, orden, descripcion, categoria } = req.body;
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

    const imageCheck = await query(
      'SELECT id FROM product_images WHERE id = $1 AND product_id = $2',
      [imageId, productId]
    );
    if (imageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const updates = {};
    if (typeof es_principal === 'boolean') updates.es_principal = es_principal;
    if (typeof orden === 'number') updates.orden = orden;
    if (typeof descripcion === 'string') updates.descripcion = descripcion;
    if (typeof categoria === 'string') updates.categoria = categoria;

    if (es_principal === true) {
      await query('UPDATE product_images SET es_principal = false WHERE product_id = $1', [productId]);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Sin datos para actualizar' });
    }

    const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(imageId);

    const result = await query(
      `UPDATE product_images SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );

    const updated = result.rows[0];
    updated.url = getPublicUrl(updated.url, baseUrl);

    if (es_principal === true) {
      try {
        await query('UPDATE products SET image = $1 WHERE id = $2', [updated.url, productId]);
      } catch (err) {
        logger.warn({ err: err.message }, 'Error sincronizando imagen principal al producto');
      }
    }

    res.json(updated);
    logAudit({
      user: req.user?.user || 'admin',
      action: 'update',
      entityType: 'product_image',
      entityId: Number(req.params.imageId),
      details: `Imagen de producto actualizada: producto ${productId}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error actualizando imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteProductImage(req, res) {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

    const result = await query(
      'SELECT * FROM product_images WHERE id = $1 AND product_id = $2',
      [imageId, productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const image = result.rows[0];
    await deleteImageAsset(image);

    await query('DELETE FROM product_images WHERE id = $1', [imageId]);

    if (image.es_principal) {
      const remaining = await query(
        'SELECT * FROM product_images WHERE product_id = $1 ORDER BY orden ASC, id ASC',
        [productId]
      );
      const imgs = (remaining.rows || []).map(i => ({ ...i, url: getPublicUrl(i.url, baseUrl) }));
      const newPrincipal = imgs.find(i => i.es_principal) || imgs[0];
      const newImageUrl = newPrincipal ? newPrincipal.url : '';
      try {
        await query('UPDATE products SET image = $1 WHERE id = $2', [newImageUrl, productId]);
      } catch (err) {
        logger.warn({ err: err.message }, 'Error re-sincronizando imagen principal tras borrado');
      }
    }

    res.json({ ok: true });
    logAudit({
      user: req.user?.user || 'admin',
      action: 'delete',
      entityType: 'product_image',
      entityId: imageId,
      details: `Imagen eliminada de producto ${productId}`,
      ip: req.ip || '',
      tenantId: req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default'
    }).catch(() => {});
  } catch (err) {
    logger.error('Error eliminando imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function replaceProductImage(req, res) {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const baseUrl = process.env.BACKEND_URL || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

    const imageCheck = await query(
      'SELECT * FROM product_images WHERE id = $1 AND product_id = $2',
      [imageId, productId]
    );
    if (imageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }

    const oldImage = imageCheck.rows[0];
    await deleteImageAsset(oldImage);

    const processed = await processFile(req.file, `${req.protocol}://${req.get('host')}`);
    const result = await query(
      'UPDATE product_images SET url = $1, filename = $2, cloudinary_public_id = $3 WHERE id = $4 RETURNING *',
      [processed.url, processed.filename, processed.cloudinary_public_id || '', imageId]
    );

    const updated = result.rows[0];
    updated.url = getPublicUrl(processed.url, baseUrl);

    if (oldImage.es_principal) {
      try {
        await query('UPDATE products SET image = $1 WHERE id = $2', [updated.url, productId]);
      } catch (err) {
        logger.warn({ err: err.message }, 'Error sincronizando imagen principal tras reemplazo');
      }
    }

    res.json(updated);
  } catch (err) {
    logger.error('Error reemplazando imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function syncProductImages(req, res) {
  try {
    const productId = Number(req.params.id);
    let { orden } = req.body;

    if (typeof orden === 'string') {
      try { orden = JSON.parse(orden); } catch (e) { /* noop */ }
    }

    if (!Array.isArray(orden)) {
      return res.status(400).json({ error: 'Se requiere un array de órdenes' });
    }

    for (let i = 0; i < orden.length; i++) {
      await query(
        'UPDATE product_images SET orden = $1 WHERE id = $2 AND product_id = $3',
        [i, Number(orden[i]), productId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('Error sincronizando orden:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  getProductImages,
  uploadProductImages,
  updateProductImage,
  deleteProductImage,
  replaceProductImage,
  syncProductImages
};
