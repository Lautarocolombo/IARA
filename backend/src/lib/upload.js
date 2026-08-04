const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const isVercel = process.env.VERCEL === 'true';
const uploadsDir = isVercel ? '/tmp/uploads/products' : path.join(__dirname, '..', '..', 'uploads', 'products');

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
    return path.basename(optimizedPath);
  } catch (err) {
    logger.warn('Sharp no disponible o error en optimización, usando archivo original:', err.message);
    return path.basename(filePath);
  }
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

async function processFile(file, baseUrl) {
  const isProduction = process.env.NODE_ENV === 'production';
  const useCloudinary = isCloudinaryConfigured();

  if (useCloudinary) {
    const cloudinaryResult = await uploadToCloudinary(file.path, file.originalname);
    if (cloudinaryResult) {
      try { fs.unlinkSync(file.path); } catch (e) { /* noop */ }
      return { url: cloudinaryResult.url, filename: path.basename(file.path), cloudinary_public_id: cloudinaryResult.public_id, isCloudinary: true };
    }
  }

  if (!useCloudinary && isProduction) {
    logger.warn('Cloudinary no está configurado en producción. Las imágenes se guardan localmente y se perderán en el próximo redeploy/reinicio. Configurá CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Render para persistencia.');
  }

  const optimizedFilename = await optimizeWithSharp(file.path);
  const relativePath = `/uploads/products/${optimizedFilename}`;
  const publicUrl = baseUrl ? `${baseUrl}${relativePath}` : relativePath;
  return { url: publicUrl, filename: optimizedFilename, cloudinary_public_id: '', isCloudinary: false };
}

async function saveFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }
  const relativePath = isVercel ? req.file.filename : `/uploads/products/${req.file.filename}`;
  res.json({
    url: relativePath,
    filename: req.file.filename,
    size: req.file.size
  });
}

function getPublicUrl(relativePath) {
  const apiBase = process.env.SITE_URL || '';
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  return `${apiBase}${relativePath}`;
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  saveFile,
  processFile,
  getPublicUrl,
  deleteFromCloudinary
};
