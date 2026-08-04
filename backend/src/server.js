const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino');
const { initDB } = require('./lib/db');
const { handleUploadError, processFile, uploadSingle } = require('./lib/upload');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/errorHandler');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

dotenv.config({ override: false });

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught Exception');
  gracefulShutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection');
});

async function gracefulShutdown(signal) {
  logger.info(`${signal || 'SIGTERM'} recibido, cerrando servidor gracefully...`);
  try {
    const { pool } = require('./lib/db');
    if (pool) {
      await pool.end();
      logger.info('Pool de base de datos cerrado');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error cerrando pool de DB');
  }
  process.exit(0);
}

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
    logger.warn({ err: err.message }, 'Error configurando Cloudinary');
  }
}

const requiredEnvVars = ['JWT_SECRET', 'ADMIN_USER'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
const hasAdminPass = !!(process.env.ADMIN_PASS_HASH || process.env.ADMIN_PASS);
if (!hasAdminPass && process.env.NODE_ENV !== 'test') {
  missingEnvVars.push('ADMIN_PASS_HASH');
}
const isProduction = process.env.NODE_ENV === 'production';
const productionEnvVars = isProduction
  ? {
      DATABASE_URL: 'connection string de PostgreSQL (ej: postgresql://user:pass@host:5432/db?sslmode=require)',
      ALLOWED_ORIGINS: 'orígenes permitidos separados por coma (ej: https://tudominio.com,http://localhost:3000)',
    }
  : {};
const missingProductionVars = Object.keys(productionEnvVars).filter(key => !process.env[key]);

if (missingEnvVars.length > 0 || missingProductionVars.length > 0) {
  console.error('='.repeat(60));
  console.error('FALTAN VARIABLES DE ENTORNO REQUERIDAS');
  console.error('='.repeat(60));
  if (missingEnvVars.length > 0) {
    console.error('\nVariables de inicio (validadas al arrancar):');
    missingEnvVars.forEach(key => {
      if (key === 'ADMIN_PASS_HASH') {
          console.error(`  ${key} → hash bcrypt de la contraseña de admin (o ADMIN_PASS en texto plano como fallback)`);
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
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', 'https://cdn.jsdelivr.net'],
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

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);

const corsOptions = allowedOrigins.length
  ? {
      origin: function(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        const allowed = allowedOrigins.some(allowed => {
          if (allowed === origin) return true;
          if (allowed.includes('*')) {
            const pattern = allowed.replace(/\*/g, '.*');
            return new RegExp('^' + pattern + '$').test(origin);
          }
          return false;
        });
        callback(null, allowed);
      },
      credentials: true,
       methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
       allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With', 'X-Request-ID'],
   }
  : {
       origin: true,
       credentials: true,
       methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With', 'X-Request-ID'],
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
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || crypto.randomUUID());
  res.locals.csrfToken = crypto.randomBytes(32).toString('hex');
  logger.debug({ reqId: res.getHeader('X-Request-ID'), method: req.method, url: req.url }, 'Request recibida');
  next();
});

const TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 600000;
app.use((req, res, next) => {
  const isUploadRoute = /^\/api\/products\/\d+\/images/.test(req.path) ||
    req.path === '/api/admin/upload' ||
    (/^\/api\/admin\/products/.test(req.path) && req.method === 'POST') ||
    (req.path === '/api/admin/products/bulk-import');
  const timeoutMs = isUploadRoute ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS;
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout', message: 'El servidor tardó demasiado en responder. Intentá de nuevo.' });
    }
  }, timeoutMs);
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
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
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/receipts'));
app.use('/api', require('./routes/heroCards'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/admin/upload', require('./middleware/auth').adminAuth, handleUploadError, uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    const processed = await processFile(req.file, `${req.protocol}://${req.get('host')}`);
    res.json({
      url: processed.url,
      filename: processed.filename,
      size: req.file.size,
      isCloudinary: processed.isCloudinary
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error procesando imagen');
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
});

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

app.use(notFound);
app.use(errorHandler);

const dbReady = initDB().then(() => {
  logger.info('Base de datos inicializada correctamente');
}).catch(err => {
  logger.error({ err: err.message, stack: err.stack }, 'Error inicializando DB');
  console.error('Error inicializando DB:', err);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  dbReady.then(() => {
    const server = app.listen(PORT, '0.0.0.0', () => logger.info(`Backend escuchando en puerto ${PORT}`));

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Puerto ${PORT} en uso. Usá PORT=${Number(PORT) + 1}`);
        process.exit(1);
      }
      throw err;
    });
  });
} else {
  module.exports = { app, dbReady };
}
