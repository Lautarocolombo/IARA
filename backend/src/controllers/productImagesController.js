const { query } = require('../lib/db');
const logger = require('../lib/logger');
const path = require('path');
const fs = require('fs');
const { uploadMultiple, handleUploadError, getPublicUrl } = require('../lib/upload');

async function getProductImages(req, res) {
  try {
    const productId = Number(req.params.id);
    const result = await query(
      'SELECT * FROM product_images WHERE product_id = $1 ORDER BY orden ASC, id ASC',
      [productId]
    );
    const images = result.rows.map(img => ({
      ...img,
      url: getPublicUrl(img.url)
    }));
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

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron imágenes' });
    }

    const existingImages = await query(
      'SELECT MAX(orden) as maxOrden FROM product_images WHERE product_id = $1',
      [productId]
    );
    const startOrden = (existingImages.rows[0]?.max_orden || -1) + 1;

    const uploaded = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const relativePath = `/uploads/products/${file.filename}`;
      const result = await query(
        'INSERT INTO product_images (product_id, url, filename, orden, es_principal) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [productId, relativePath, file.filename, startOrden + i, false]
      );
      uploaded.push({
        ...result.rows[0],
        url: getPublicUrl(relativePath)
      });
    }

    res.status(201).json({ ok: true, images: uploaded });
  } catch (err) {
    logger.error('Error subiendo imágenes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateProductImage(req, res) {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const { es_principal, orden } = req.body;

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
    updated.url = getPublicUrl(updated.url);
    res.json(updated);
  } catch (err) {
    logger.error('Error actualizando imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteProductImage(req, res) {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);

    const result = await query(
      'SELECT * FROM product_images WHERE id = $1 AND product_id = $2',
      [imageId, productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const image = result.rows[0];
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'products', image.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await query('DELETE FROM product_images WHERE id = $1', [imageId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error eliminando imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function syncProductImages(req, res) {
  try {
    const productId = Number(req.params.id);
    const { orden } = req.body;

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
  syncProductImages
};
