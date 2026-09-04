const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');
const { optimizeImage } = require('./imageOptimizer');

const BLOB_URL_RE = /^https?:\/\/[^/]+\.blob\.vercel-storage\.com/;

function isBlobConfigured() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!token) return false;
  if (!token.startsWith('vercel_blob_')) {
    logger.warn('BLOB_READ_WRITE_TOKEN tiene un formato inválido. Debe comenzar con "vercel_blob_". Ignorando token.');
    return false;
  }
  return true;
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

async function uploadProofToBlob(file) {
  const mod = getBlobModule();
  if (!mod || !isBlobConfigured()) {
    return null;
  }
  try {
    const buffer = fs.readFileSync(file.path);
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const safe = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const contentType = file.mimetype || 'application/octet-stream';
    const blobName = `comprobantes/${Date.now()}_${safe}${ext}`;

    const blob = await mod.put(blobName, buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN.trim(),
      contentType
    });

    return { url: blob.url, filename: blobName, blobName, isCloudinary: false, isBlob: true };
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, code: err.code }, 'Error subiendo comprobante a Vercel Blob - fallback a storage local');
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
async function uploadToBlob(file) {
  const mod = getBlobModule();
  if (!mod || !isBlobConfigured()) {
    return null;
  }
  let tmpDir = null;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blob-upload-'));
    const ext = path.extname(file.originalname).toLowerCase() || '.webp';
    const safe = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const tmpPath = path.join(tmpDir, `${Date.now()}_${safe}${ext}`);
    fs.copyFileSync(file.path, tmpPath);

    const optimizedPath = await optimizeImage(tmpPath, { format: 'webp' });
    let buffer = fs.readFileSync(optimizedPath);
    let contentType = path.extname(optimizedPath).toLowerCase() === '.webp' ? 'image/webp' : file.mimetype || 'application/octet-stream';

    const blobName = `products/${Date.now()}_${safe}${ext}`;

    const blob = await mod.put(blobName, buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN.trim(),
      contentType
    });

    return { url: blob.url, filename: blobName, blobName, isCloudinary: false, isBlob: true };
  } catch (err) {
    const hint = err.code === 401 || err.code === 403
      ? 'Token inválido o revocado. Generá un nuevo token en Vercel Blob y actualizá BLOB_READ_WRITE_TOKEN en Render.'
      : err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED'
        ? 'Error de red conectando a Vercel Blob. Verificá la conectividad desde Render.'
        : 'Error desconocido. Verificá los logs para más detalles.';
    logger.error({ err: err.message, stack: err.stack, code: err.code, hint }, 'Error subiendo a Vercel Blob - fallback a storage local');
    return null;
  } finally {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* noop */ }
    }
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
  return false;
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
    fileSize: 5 * 1024 * 1024
  }
});

const uploadSingle = upload.single('image');
const uploadMultiple = upload.array('images', 10);

const uploadTestimonialFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'productImage', maxCount: 1 }
]);

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
      return res.status(400).json({ error: 'La imagen es muy grande (máximo 5MB)' });
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

async function processFile(file, _baseUrl) {
  const optimizedPath = await optimizeImage(file.path, { format: 'webp' });
  const buffer = fs.readFileSync(optimizedPath);
  const base64 = buffer.toString('base64');
  const dataUri = 'data:image/webp;base64,' + base64;

  const ext = path.extname(file.path);
  const baseName = path.basename(file.path, ext);
  const expectedOptimized = path.join(path.dirname(file.path), `${baseName}.webp`);

  const targets = new Set([file.path, optimizedPath, expectedOptimized]);
  for (const target of targets) {
    try {
      fs.rmSync(target, { force: true, maxRetries: 3, retryDelay: 50 });
    } catch (e) { /* noop */ }
  }

  logger.info('[Upload] Imagen guardada como base64 en Neon:', { size: dataUri.length });
  return { url: dataUri, filename: file.originalname, cloudinary_public_id: '', isCloudinary: false, isBlob: false, isBase64: true };
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
  if (relativePath.startsWith('data:')) {
    return relativePath;
  }
  if (relativePath.startsWith('http')) return relativePath;
  const prefix = baseUrl || process.env.BACKEND_URL || process.env.SITE_URL || '';
  const withPrefix = prefix ? `${prefix}${relativePath}` : relativePath;
  if (relativePath.startsWith('/uploads/')) {
    if (fileExistsCache.has(relativePath)) return withPrefix;
    if (fileMissingCache.has(relativePath)) return withPrefix;
    const isVercel = process.env.VERCEL === 'true';
    const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;
    const isEphemeralProd = !isVercel && process.env.NODE_ENV === 'production';
    const baseDir = (isVercel || isRender || isEphemeralProd) ? '/tmp' : path.join(__dirname, '..', '..');
    const filePath = path.join(baseDir, relativePath);
    if (fs.existsSync(filePath)) {
      fileExistsCache.add(relativePath);
      return withPrefix;
    }
    fileMissingCache.add(relativePath);
    logger.warn(`Imagen no encontrada en filesystem: ${relativePath}`);
    return withPrefix;
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
  uploadTestimonialFields,
  handleUploadError,
  saveFile,
  processFile,
  getPublicUrl,
  deleteFromBlob,
  deleteImageAsset,
  saveUploadedFile,
  uploadProofToBlob,
  isBlobConfigured,
  isBlobUrl
};