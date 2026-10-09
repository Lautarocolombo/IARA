const express = require('express');
const router = express.Router();
const { getImageFromDB } = require('../lib/mediaService');
const logger = require('../lib/logger');

router.get('/media/:id', async (req, res) => {
  try {
    const mediaId = parseInt(req.params.id, 10);
    if (isNaN(mediaId)) {
      return res.status(400).json({ error: 'ID de imagen inválido' });
    }

    const image = await getImageFromDB(mediaId);
    if (!image) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    res.setHeader('Content-Type', image.content_type);
    res.setHeader('Content-Length', image.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (image.filename) {
      res.setHeader('Content-Disposition', `inline; filename="${image.filename}"`);
    }

    res.send(image.data);
  } catch (err) {
    logger.error('[Media] Error sirviendo imagen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;