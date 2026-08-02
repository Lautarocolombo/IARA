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

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    logger.info('Cloudinary configurado correctamente');
  } catch (err) {
    logger.warn('Error configurando Cloudinary:', err.message);
  }
}

const requiredEnvVars = ['JWT_SECRET', 'ADMIN_USER', 'ADMIN_PASS'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
const isTest = process.env.NODE_ENV === 'test';
const productionEnvVars = isTest
  ? {}
  : {
      DATABASE_URL: 'connection string de PostgreSQL (ej: postgresql://user:pass@host:5432/db?sslmode=require)',
      ALLOWED_ORIGINS: 'orígenes permitidos separados por coma (ej: https://tudominio.com,http://localhost:3000)',
    };
const missingProductionVars = Object.keys(productionEnvVars).filter(key => !process.env[key]);
if (missingEnvVars.length > 0 || missingProductionVars.length > 0) {
  console.error('='.repeat(60));
  console.error('FALTAN VARIABLES DE ENTORNO REQUERIDAS');
  console.error('='.repeat(60));
  if (missingEnvVars.length > 0) {
    console.error('\nVariables de inicio (validadas al arrancar):');
    missingEnvVars.forEach(key => {
      if (key === 'ADMIN_PASS') {
        console.error(`  ${key} → contraseña de admin en texto plano (ej: pulseras2026)`);
      } else if (key === 'JWT_SECRET') {
        console.error(`  ${key} → generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`);
      } else if (key === 'ADMIN_USER') {
        console.error(`  ${key} → nombre de usuario admin, ej: Iara`);
      } else {
        console.error(`  ${key} → ${productionEnvVars[key] || 'valor requerido'}`);
      }
    });
  }
  if (missingProductionVars.length > 0) {
    console.error('\nVariables de producción necesarias para el funcionamiento:');
    missingProductionVars.forEach(key => {
      console.error(`  ${key} → ${productionEnvVars[key]}`);
    });
  }
  console.error('\nCómo cargarlas en Render:');
  console.error('  1. https://dashboard.render.com → tu servicio → Settings');
  console.error('  2. Sección "Environment" → "Add Environment Variable"');
  console.error('  3. Agregá cada variable con su nombre y valor');
  console.error('='.repeat(60));
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
      connectSrc: ['\'self\''],
      frameSrc: ['\'self\'', 'https://maps.google.com', 'https://www.google.com'],
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

function isOriginAllowed(origin) {
  if (!origin) return true;
  return allowedOrigins.some(allowed => {
    if (allowed === origin) return true;
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp('^' + pattern + '$').test(origin);
    }
    return false;
  });
}

if (!allowedOrigins.length && process.env.NODE_ENV === 'production') {
  logger.warn('ALLOWED_ORIGINS no estÃ¡ configurado en producciÃ³n. El CORS puede fallar para orÃ­genes no permitidos.');
}

const corsOptions = allowedOrigins.length
  ? {
      origin: isOriginAllowed,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With'],
    }
  : {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With'],
    };

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en unos minutos' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
app.use('/api', require('./routes/paymentConfig'));
app.use('/api', require('./routes/siteSettings'));
app.use('/api', require('./routes/sitemap'));
app.use('/api', require('./routes/reviews'));
app.use('/api', require('./routes/productImages'));
app.use('/api/health', require('./routes/health'));

const TIMEOUT_MS = 10000;
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout', message: 'El servidor tardó demasiado en responder. Intentá de nuevo.' });
    }
  }, TIMEOUT_MS);
  res.on('finish', () => clearTimeout(timeout));
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

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
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => logger.info(`Backend escuchando en http://${HOST}:${PORT}`));
} else {
  module.exports = app;
}