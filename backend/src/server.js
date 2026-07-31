// Sentry debe inicializarse antes que cualquier otro require.
require('./instrument');

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const { initDB, pool, db } = require('./lib/db');
const { handleUploadError, saveFile, uploadSingle } = require('./lib/upload');
const { loginLimiter, globalLimiter, csrfProtection, getCSRFToken } = require('./middleware/rateLimit');
const Sentry = require('./instrument');

const logger = pino({
  level: process.env.LOG_LEVEL || 'debug'
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  Sentry.captureException(err);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection');
  Sentry.captureException(reason);
});

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      imgSrc: ['\'self\'', 'data:', 'https:', 'http:'],
      scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://js.mercadolibre.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      connectSrc: ['\'self\'', 'https://api.mercadolibre.com'],
      fontSrc: ['\'self\'', 'https:', 'data:'],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'self\'', 'https://www.mercadopago.com']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(globalLimiter);
app.use(csrfProtection);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);
const normalize = (o) => o.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, origin);
    const normalized = normalize(origin);
    const allowed = allowedOrigins.find(o => normalized === normalize(o) || normalized.endsWith('.' + normalize(o)));
    if (allowed) return callback(null, origin);
    return callback(new Error('Origin not allowed'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));

// Health check & keep-alive
app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    if (pool) {
      await pool.query('SELECT 1');
    } else if (db) {
      await new Promise((resolve, reject) => {
        db.get('SELECT 1', (err) => err ? reject(err) : resolve());
      });
    }
  } catch (err) {
    dbStatus = 'error';
  }
  res.json({ ok: dbStatus === 'ok', db: dbStatus, timestamp: Date.now() });
});
app.get('/api/ping', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// CSRF token endpoint (para forms que no usan JWT)
app.get('/api/csrf-token', getCSRFToken, (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

app.get('/api/config', (req, res) => {
  res.json({
    apiBaseUrl: process.env.API_BASE_URL || '',
    payment: {
      publicKey: process.env.MP_PUBLIC_KEY || ''
    },
    reviews: {
      googlePlaceId: process.env.GOOGLE_PLACE_ID || '',
      googleWriteReviewUrl: process.env.GOOGLE_WRITE_REVIEW_URL || ''
    },
    business: {
      name: process.env.BUSINESS_NAME || 'Artesanía Gualeguay',
      email: process.env.BUSINESS_EMAIL || 'contacto@artesaniagualeguay.com',
      whatsapp: process.env.WHATSAPP || '+5493444634444',
      instagram: process.env.INSTAGRAM_URL || '#',
      facebook: process.env.FACEBOOK_URL || '#',
      twitter: process.env.TWITTER_URL || '#'
    },
    shipping: {
      cost: Number(process.env.SHIPPING_COST || 200),
      threshold: Number(process.env.SHIPPING_THRESHOLD || 2000)
    }
  });
});

// Routes (MVC)
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api', require('./routes/products'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/payments'));
app.use('/api/subscribers', require('./routes/subscribers'));
app.use('/api', require('./routes/siteTexts'));
app.use('/api', require('./routes/testimonials'));
app.use('/api', require('./routes/reviews'));
app.use('/api', require('./routes/reports'));
app.use('/api/admin/product-images', require('./routes/productImages'));
app.use('/api/admin/users', require('./routes/users'));
app.use('/api/admin/subscribers', require('./routes/adminSubscribers'));
app.use('/api/admin/settings', require('./routes/settings'));
app.use('/api/admin/categories', require('./routes/categories'));
app.use('/api/admin/payments', require('./routes/adminPayments'));

// Webhook MercadoPago
const { handleWebhook, verifyMercadoPagoWebhook } = require('./controllers/paymentController');
app.post('/api/payments/webhook', verifyMercadoPagoWebhook, handleWebhook);

// Upload con multer
async function adminUploadHandler(req, res) {
  try {
    const result = await saveFile(req, res);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error en upload admin:', err);
    res.status(500).json({ error: 'Error interno al guardar el archivo' });
  }
}

app.post('/api/admin/upload', require('./middleware/auth').adminAuth, uploadSingle, handleUploadError, adminUploadHandler);

// Static files
const staticDir = path.join(__dirname, '..', '..', 'public');
const uploadsDir = path.join(__dirname, '..', 'uploads');

app.use('/uploads', express.static(uploadsDir));
app.use('/css', express.static(path.join(staticDir, 'css')));
app.use('/js', express.static(path.join(staticDir, 'js')));
const { productMetaMiddleware } = require('./lib/metaInjector');
const SITE_URL = process.env.SITE_URL || '';
app.get('/pages/product.html', productMetaMiddleware(staticDir, SITE_URL));

app.use('/pages', express.static(path.join(staticDir, 'pages')));

app.get('/admin.html', (req, res) => {
    res.redirect(301, '/pages/admin.html');
  });

  

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use(express.static(staticDir));

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(staticDir, 'favicon.svg'));
});

// Sentry captura la excepción antes de que llegue al error handler propio.
Sentry.setupExpressErrorHandler(app);

// Error handler
app.use((err, req, res, _next) => {
  logger.error({ err, path: req.path, method: req.method }, 'Server error');
  res.status(err.status || 500).json({ error: err.message || (process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : 'Error interno del servidor') });
});

// Init DB y start
initDB().catch(err => {
  logger.error({ err }, 'Error inicializando DB');
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Backend escuchando en http://localhost:${PORT}`));
} else {
  module.exports = app;
}