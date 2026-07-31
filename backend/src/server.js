const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { initDB } = require('./lib/db');
const { handleUploadError, saveFile } = require('./lib/upload');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

dotenv.config();

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.mercadopago.com"],
      frameSrc: ["'self'", "https://www.mercadopago.com.ar"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);
const corsOptions = allowedOrigins.length
  ? { origin: allowedOrigins, credentials: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }
  : { origin: '*', credentials: true };
app.use(cors(corsOptions));

// Health check & keep-alive
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));
app.get('/api/ping', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// Routes (MVC)
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/products'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/payments'));
app.use('/api', require('./routes/siteTexts'));
app.use('/api', require('./routes/testimonials'));

// Upload con multer
app.post('/api/admin/upload', require('./middleware/auth').adminAuth, handleUploadError, saveFile);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));
const staticDir = path.join(__dirname, '..', '..', 'frontend');

app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use(express.static(staticDir));

app.get('/*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Init DB y start
initDB().catch(err => {
  console.error('Error inicializando DB:', err.message);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Backend escuchando en http://localhost:${PORT}`));
} else {
  module.exports = app;
}