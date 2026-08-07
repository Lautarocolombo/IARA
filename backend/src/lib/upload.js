const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const BLOB_URL_RE = /^https?:\/\/[^/]+\.blob\.vercel-storage\.com/;

function isBlobConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

let blobModule = null;
let blobModuleLoadAttempted = false;

function getBlobModule() {
  if (blobModule) return blobModule;
  if (blobModuleLoadAttempted) return null;
  blobModuleLoadAttempted = true;
  try {
    blobModule = require('@vercel/blob');
  } catch (err) {
    logger.warn('No se pudo cargar @vercel/blob:', err.message);
    blobModule = null;
  }
  return blobModule;
}

function isBlobUrl(url) {
  return !!(url && typeof url === 'string' && BLOB_URL_RE.test(url));
}

async function uploadToBlob(file) {
  const mod = getBlobModule();
  if (!mod || !isBlobConfigured()) {
    return null;
  }
  try {
    let buffer = fs.readFileSync(file.path);
    let contentType = file.mimetype || 'application/octet-stream';

    try {
      const sharp = require('sharp');
      const optimized = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      buffer = optimized;
      contentType = 'image/webp';
    } catch (err) {
      logger.warn('Sharp no disponible para optimización en Blob, subiendo original:', err.message);
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.webp';
    const safe = file.originalname
      .replace(/\.[^.\\/]*$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobName = `products/${Date.now()}_${safe}${ext}`;

    const blob = await mod.put(blobName, buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType
    });

    return { url: blob.url, filename: blobName, blobName, isBlob: true };
  } catch (err) {
    logger.error('Error subiendo a Vercel Blob:', err.message);
    return null;
  }
}

async function deleteFromBlob(url) {
  if (!isBlobUrl(url)) return false;
  const mod = getBlobModule();
  if (!mod || !isBlobConfigured()) return false;
  try {
    await mod.del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return true;
  } catch (err) {
    logger.warn('Error eliminando de Vercel Blob:', err.message);
    return false;
  }
}

async function deleteImageAsset(image) {
  if (!image) return false;
  let deleted = false;

  if (image.cloudinary_public_id) {
    try { if (await deleteFromCloudinary(image.cloudinary_public_id)) deleted = true; } catch (e) { /* noop */ }
  }

  if (image.url) {
    if (await deleteFromBlob(image.url)) deleted = true;
  }

  if (image.filename && !isBlobUrl(image.url)) {
    const localPath = path.join(__dirname, '..', '..', 'uploads', 'imagenes', image.filename);
    try { if (fs.existsSync(localPath)) { fs.unlinkSync(localPath); deleted = true; } } catch (e) { /* noop */ }
  }

  return deleted;
}

const isVercel = process.env.VERCEL === 'true';
const uploadsDir = isVercel ? '/tmp/uploads/imagenes' : path.join(__dirname, '..', '..', 'uploads', 'imagenes');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    logger.error('Error creando directorio de uploads:', err.message);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
    filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedDocs = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (allowedImages.includes(file.mimetype) || allowedDocs.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Usá JPG, PNG, WEBP, GIF o CSV.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

const uploadSingle = upload.single('image');
const uploadMultiple = upload.array('images', 10);

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La imagen es muy grande (máximo 200MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Máximo 10 imágenes por envío' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

async function optimizeWithSharp(filePath) {
  try {
    const sharp = require('sharp');
    const ext = path.extname(filePath).toLowerCase();
    const optimizedPath = filePath.replace(ext, '.webp');
    await sharp(filePath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(optimizedPath);
    if (optimizedPath !== filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return optimizedPath;
  } catch (err) {
    logger.warn('Sharp no disponible o error en optimización, usando archivo original:', err.message);
    return filePath;
  }
}

async function fileToBase64DataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

function isCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return !!(cloudName && apiKey && apiSecret);
}

async function ensureCloudinaryConfigured() {
  const cloudinary = require('cloudinary').v2;
  if (!isCloudinaryConfigured()) {
    return false;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  return true;
}

async function uploadToCloudinary(filePath, _originalName) {
  try {
    const cloudinary = require('cloudinary').v2;
    const configured = await ensureCloudinaryConfigured();
    if (!configured) {
      logger.warn('Cloudinary no configurado completamente (faltan CLOUDINARY_CLOUD_NAME, API_KEY o API_SECRET)');
      return null;
    }
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(filePath, {
        folder: 'artesania-gualeguay/products',
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
    return { url: result.secure_url, public_id: result.public_id };
  } catch (err) {
    logger.warn('Error subiendo a Cloudinary, usando local:', err.message);
    return null;
  }
}

async function deleteFromCloudinary(publicId) {
  try {
    const cloudinary = require('cloudinary').v2;
    if (!publicId || !cloudinary.config().cloud_name) return false;
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return true;
  } catch (err) {
    logger.warn('Error eliminando de Cloudinary:', err.message);
    return false;
  }
}

async function processFile(file, _baseUrl) {
  const useBlob = isBlobConfigured();

  if (useBlob) {
    const blobResult = await uploadToBlob(file);
    if (blobResult) {
      try { fs.unlinkSync(file.path); } catch (e) { /* noop */ }
      return { url: blobResult.url, filename: blobResult.filename, cloudinary_public_id: '', isCloudinary: false, isBlob: true };
    }
    logger.warn('El upload a Vercel Blob falló, intentando fallback...');
  }

  const useCloudinary = isCloudinaryConfigured();
  if (useCloudinary) {
    const cloudinaryResult = await uploadToCloudinary(file.path, file.originalname);
    if (cloudinaryResult) {
      try { fs.unlinkSync(file.path); } catch (e) { /* noop */ }
      return { url: cloudinaryResult.url, filename: path.basename(file.path), cloudinary_public_id: cloudinaryResult.public_id, isCloudinary: true };
    }
  }

  const optimizedPath = await optimizeWithSharp(file.path);
  const filename = path.basename(optimizedPath);
  const relativeUrl = `/uploads/imagenes/${filename}`;

  const resolvedBaseUrl = process.env.BACKEND_URL || process.env.SITE_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : 'http://localhost:10000');
  const absoluteUrl = `${resolvedBaseUrl}${relativeUrl}`;

  return { url: absoluteUrl, filename, cloudinary_public_id: '', isCloudinary: false, isBlob: false };
}

async function saveFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }
  const processed = await processFile(req.file, '');
  res.json({
    url: processed.url,
    filename: processed.filename,
    size: req.file.size,
    isCloudinary: processed.isCloudinary,
    isBlob: processed.isBlob
  });
}

const fileExistsCache = new Set();
const fileMissingCache = new Set();

function getPublicUrl(relativePath, baseUrl) {
  if (!relativePath) return '';
  if (relativePath.startsWith('data:')) return relativePath;
  if (relativePath.startsWith('http')) return relativePath;
  const prefix = baseUrl || process.env.BACKEND_URL || process.env.SITE_URL || '';
  const withPrefix = prefix ? `${prefix}${relativePath}` : relativePath;
  if (relativePath.startsWith('/uploads/')) {
    if (fileMissingCache.has(relativePath)) return '';
    if (fileExistsCache.has(relativePath)) return withPrefix;
    const filePath = path.join(__dirname, '..', '..', relativePath);
    if (fs.existsSync(filePath)) {
      fileExistsCache.add(relativePath);
      return withPrefix;
    }
    fileMissingCache.add(relativePath);
    logger.warn(`Imagen no encontrada en filesystem: ${relativePath}`);
    return '';
  }
     return withPrefix;
}

async function saveUploadedFile(file) {
  const processed = await processFile(file);
  const resolvedBaseUrl = process.env.BACKEND_URL || process.env.SITE_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : 'http://localhost:10000');
  return getPublicUrl(processed.url, resolvedBaseUrl);
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  saveFile,
  processFile,
  getPublicUrl,
  deleteFromCloudinary,
  uploadToBlob,
  deleteFromBlob,
  deleteImageAsset,
  saveUploadedFile,
  isBlobConfigured,
  isBlobUrl
};
