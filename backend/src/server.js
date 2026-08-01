const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino');
const { initDB } = require('./lib/db');
const { handleUploadError, saveFile } = require('./lib/upload');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

dotenv.config();

const requiredEnvVars = ['JWT_SECRET', 'ADMIN_USER', 'ADMIN_PASS'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error('Faltan variables de entorno requeridas:', missingEnvVars.join(', '));
  console.error('Agregalas en el dashboard de Render → Environment');
  process.exit(1);
}

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\''],
      styleSrc: ['\'self\'', 'https://fonts.googleapis.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
      connectSrc: ['\'self\'', 'https://api.mercadopago.com'],
      frameSrc: ['\'self\'', 'https://www.mercadopago.com.ar', 'https://maps.google.com', 'https://www.google.com'],
      objectSrc: ['\'none\''],
      baseUri: ['\'self\''],
      formAction: ['\'self\'']
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);
const corsOptions = allowedOrigins.length
  ? { origin: allowedOrigins, credentials: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }
  : { origin: '*', credentials: true };
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en unos minutos' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión, intentá de nuevo en 15 minutos' }
});
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados envíos de formulario, intentá de nuevo en una hora' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/orders', contactLimiter);
app.use(limiter);

app.use((req, res, next) => {
  res.setHeader('X-Request-ID', crypto.randomUUID());
  res.locals.csrfToken = crypto.randomBytes(32).toString('hex');
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/auth'));
app.use('/api', require('./routes/products'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/payments'));
app.use('/api', require('./routes/siteTexts'));
app.use('/api', require('./routes/testimonials'));
app.use('/api', require('./routes/newsletter'));
app.use('/api', require('./routes/contact'));
app.use('/api', require('./routes/siteConfig'));
app.use('/api', require('./routes/siteSettings'));
app.use('/api', require('./routes/sitemap'));
app.use('/api', require('./routes/reviews'));

app.post('/api/admin/upload', require('./middleware/auth').adminAuth, handleUploadError, saveFile);

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

app.use((err, req, res, _next) => {
  logger.error('Server error:', err.message);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Error interno del servidor'
    : err.message;
  res.status(statusCode).json({ error: message });
});

initDB().then(() => {
  logger.info('Base de datos inicializada correctamente');
}).catch(err => {
  logger.error('Error inicializando DB:', err);
  console.error('Error inicializando DB:', err);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Backend escuchando en http://localhost:${PORT}`));
} else {
  module.exports = app;
}