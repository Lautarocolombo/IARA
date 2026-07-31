const multer = require('multer');
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === 'true';
const isRender = process.env.RENDER && !isVercel;
const uploadsDir = isVercel ? '/tmp/uploads/products' : isRender ? '/tmp/uploads/products' : path.join(__dirname, '..', '..', 'uploads', 'products');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creando directorio de uploads:', err.message);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Usá JPG, PNG, WEBP o GIF.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

const uploadSingle = upload.single('image');

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La imagen es muy grande (máximo 5MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

async function uploadToCloudinary(filePath, _originalname) {
  const cloudinary = require('cloudinary');
  if (!cloudinary.v2 || !process.env.CLOUDINARY_CLOUD_NAME) return null;
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.v2.uploader.upload(filePath, {
        folder: 'iara/products',
        resource_type: 'image',
        use_filename: true,
        unique_filename: false
      }, (err, res) => err ? reject(err) : resolve(res));
    });
    return { url: result.secure_url, public_id: result.public_id };
  } catch (err) {
    console.error('Error subiendo a Cloudinary:', err.message);
    return null;
  }
}

async function saveFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }

  if (isVercel && process.env.CLOUDINARY_CLOUD_NAME) {
    const uploaded = await uploadToCloudinary(req.file.path, req.file.originalname);
    try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup error */ }
    if (uploaded) {
      return { url: uploaded.url, isBase64: false, provider: 'cloudinary' };
    }
  }

  if (isRender && process.env.CLOUDINARY_CLOUD_NAME) {
    const uploaded = await uploadToCloudinary(req.file.path, req.file.originalname);
    try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup error */ }
    if (uploaded) {
      return { url: uploaded.url, isBase64: false, provider: 'cloudinary' };
    }
    console.warn('[Upload] Cloudinary no configurado en Render. La imagen se perderá al reiniciar.');
  }

  if (isVercel) {
    const buffer = fs.readFileSync(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup error */ }
    return { url: dataUrl, isBase64: true };
  }

  if (isRender) {
    const buffer = fs.readFileSync(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup error */ }
    return { url: dataUrl, isBase64: true };
  }

  const relativePath = `/uploads/products/${req.file.filename}`;
  return { url: relativePath, filename: req.file.filename, size: req.file.size };
}

module.exports = {
  uploadSingle,
  handleUploadError,
  saveFile
};
