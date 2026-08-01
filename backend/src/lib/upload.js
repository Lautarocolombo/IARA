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
    filesLimit: 1
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

module.exports = {
  uploadSingle,
  handleUploadError,
  saveFile
};