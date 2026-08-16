const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { optimizeImage } = require('./imageOptimizer');

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
    const optimizedPath = await optimizeImage(file.path, { format: 'webp' });
    let buffer = fs.readFileSync(optimizedPath);
    let contentType = path.extname(optimizedPath).toLowerCase() === '.webp' ? 'image/webp' : file.mimetype || 'application/octet-stream';

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

    return { url: blob.url, filename: blobName, blobName, isCloudinary: false, isBlob: true };
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
const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;
const isEphemeralProd = !isVercel && process.env.NODE_ENV === 'production';
const uploadsDir = (isVercel || isRender || isEphemeralProd) ? '/tmp/uploads/imagenes' : path.join(__dirname, '..', '..', 'uploads', 'imagenes');

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

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const proofDir = (isVercel || isRender || isEphemeralProd) ? '/tmp/uploads/comprobantes' : path.join(__dirname, '..', '..', 'uploads', 'comprobantes');
    if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });
    cb(null, proofDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}${ext}`);
  }
});

const proofFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Usá JPG, PNG, WEBP o PDF.'), false);
  }
};

const uploadProof = multer({
  storage: proofStorage,
  fileFilter: proofFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const uploadSingleProof = uploadProof.single('image');

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

async function fileToBase64DataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif'
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

let sharpAvailable = false;
try {
  require('sharp');
  sharpAvailable = true;
} catch (e) {
  // noop
}
if (sharpAvailable) {
  logger.info('Sharp: disponible para optimización de imágenes');
} else {
  logger.warn('Sharp: NO disponible. Las imágenes no se optimizarán a WebP.');
}

async function processFile(file, baseUrl) {
  const useBlob = isBlobConfigured();
  console.log('[Upload] processFile start:', { useBlob, filename: file.originalname, size: file.size, NODE_ENV: process.env.NODE_ENV, isRender: !!process.env.RENDER_EXTERNAL_HOSTNAME });

  if (useBlob) {
    const blobResult = await uploadToBlob(file);
    if (blobResult) {
      try { fs.unlinkSync(file.path); } catch (e) { /* noop */ }
      console.log('[Upload] Subido a Vercel Blob:', blobResult.url);
      return { url: blobResult.url, filename: blobResult.filename, cloudinary_public_id: '', isCloudinary: false, isBlob: true };
    }
    console.warn('[Upload] Upload a Vercel Blob falló, intentando fallback...');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;

  if (!useBlob && isProduction && !isRender) {
    const err = new Error('Storage de imágenes no configurado. Necesitás configurar BLOB_READ_WRITE_TOKEN en Render para subir imágenes.');
    console.error({ err: err.message }, '[Upload] Bloqueado: falta configuración de storage persistente');
    throw err;
  }

  const optimizedPath = await optimizeImage(file.path, { format: 'webp' });
  const filename = path.basename(optimizedPath);
  const relativeUrl = `/uploads/imagenes/${filename}`;

  const resolvedBaseUrl = baseUrl || process.env.SITE_URL || process.env.BACKEND_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : 'http://localhost:10000');
  const absoluteUrl = `${resolvedBaseUrl}${relativeUrl}`;

  if (isRender) {
    try {
      const dataUri = await fileToBase64DataUri(optimizedPath);
      try { fs.unlinkSync(file.path); } catch (e) { /* noop */ }
      if (optimizedPath !== file.path) {
        try { fs.unlinkSync(optimizedPath); } catch (e) { /* noop */ }
      }
      console.log('[Upload] Fallback base64 para Render (producción efímera)');
      return { url: dataUri, filename, cloudinary_public_id: '', isCloudinary: false, isBlob: false };
    } catch (e) {
      console.warn({ err: e.message, stack: e.stack }, '[Upload] Error convirtiendo imagen a base64 para fallback persistente, usando URL local');
    }
  }

  console.log('[Upload] URL generada:', absoluteUrl);
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
  return getPublicUrl(processed.url);
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadSingleProof,
  handleUploadError,
  saveFile,
  processFile,
  getPublicUrl,
  deleteFromBlob,
  deleteImageAsset,
  saveUploadedFile,
  isBlobConfigured,
  isBlobUrl
};