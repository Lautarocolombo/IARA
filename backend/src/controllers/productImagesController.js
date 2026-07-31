const { query } = require('../lib/db');
const { saveFile } = require('../lib/upload');

async function addProductImage(req, res) {
  try {
    const productId = Number(req.params.productId);
    if (!productId) return res.status(400).json({ error: 'ID de producto inválido' });

    const productResult = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }

    const isPrimary = (req.body.is_primary === 'true' || req.body.is_primary === true);
    if (isPrimary) {
      await query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
    }

    const urlResult = await saveFile(req, res);
    const imageUrl = urlResult.url || '';

    if (!imageUrl) {
      return res.status(500).json({ error: 'Error al guardar la imagen' });
    }

    const imgResult = await query(
      'INSERT INTO product_images (product_id, url, alt, sort_order, is_primary) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [productId, imageUrl, req.body.alt || '', Number(req.body.sort_order || 0), isPrimary]
    );
    res.status(201).json(imgResult.rows[0]);
  } catch (err) {
    console.error('Error agregando imagen de producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listProductImages(req, res) {
  try {
    const productId = Number(req.params.productId);
    const result = await query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC', [productId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listando imágenes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteProductImage(req, res) {
  const productId = Number(req.params.productId);
  const imageId = Number(req.params.imageId);
  try {
    const result = await query('DELETE FROM product_images WHERE product_id = $1 AND id = $2 RETURNING id, url', [productId, imageId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function setPrimaryImage(req, res) {
  const productId = Number(req.params.productId);
  const imageId = Number(req.params.imageId);
  try {
    await query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
    await query('UPDATE product_images SET is_primary = true WHERE product_id = $1 AND id = $2', [productId, imageId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error seteando imagen principal:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  addProductImage,
  listProductImages,
  deleteProductImage,
  setPrimaryImage
};
