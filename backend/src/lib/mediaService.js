const { query } = require('./db');
const { optimizeImage } = require('./imageOptimizer');
const logger = require('./logger');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function saveImageToDB(file, tenantId = 'default', uploadedBy = 'admin') {
  if (!file || !file.path) {
    throw new Error('Archivo no válido');
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new Error('Tipo de archivo no permitido. Usá JPG, PNG o WEBP.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('La imagen es muy grande (máximo 5MB)');
  }

  const fs = require('fs');
  const path = require('path');

  let buffer = fs.readFileSync(file.path);
  let contentType = file.mimetype;
  let filename = file.originalname;
  let width = null;
  let height = null;

  try {
    const optimizedPath = await optimizeImage(file.path, { format: 'webp' });
    buffer = fs.readFileSync(optimizedPath);
    contentType = 'image/webp';
    filename = path.basename(file.originalname, path.extname(file.originalname)) + '.webp';
    
    const sharp = require('sharp');
    const metadata = await sharp(optimizedPath).metadata();
    width = metadata.width;
    height = metadata.height;
  } catch (err) {
    logger.warn('Error optimizando imagen, guardando original:', err.message);
    const sharp = require('sharp');
    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width;
      height = metadata.height;
    } catch (e) {
      // ignore
    }
  }

  const result = await query(
    `INSERT INTO media_assets (filename, content_type, data, size, width, height, uploaded_by, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [filename, contentType, buffer, buffer.length, width, height, uploadedBy, tenantId]
  );

  const mediaId = result.rows[0].id;
  logger.info('[Media] Imagen guardada en DB:', { mediaId, filename, size: buffer.length, contentType });
  
  return { mediaId, filename, contentType, size: buffer.length, width, height };
}

async function getImageFromDB(mediaId) {
  const result = await query(
    'SELECT id, filename, content_type, data, size, width, height FROM media_assets WHERE id = $1',
    [mediaId]
  );
  return result.rows[0] || null;
}

async function deleteImageFromDB(mediaId) {
  if (!mediaId) return false;
  const result = await query('DELETE FROM media_assets WHERE id = $1', [mediaId]);
  return result.rowCount > 0;
}

async function getMediaUrl(mediaId, baseUrl) {
  if (!mediaId) return '';
  const prefix = baseUrl || process.env.BACKEND_URL || process.env.SITE_URL || '';
  return `${prefix}/api/media/${mediaId}`;
}

module.exports = {
  saveImageToDB,
  getImageFromDB,
  deleteImageFromDB,
  getMediaUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE
};