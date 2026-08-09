const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino');
const { initDB } = require('./lib/db');
const { handleUploadError, processFile, uploadSingle, getPublicUrl } = require('./lib/upload');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/errorHandler');

let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  } catch (err) {
    console.warn('Sentry no disponible:', err.message);
  }
}

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

const requiredEnvVars = ['JWT_SECRET', 'ADMIN_USER', 'ADMIN_PASS_HASH'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  if (!process.env.DATABASE_URL) missingEnvVars.push('DATABASE_URL');
  if (!process.env.ALLOWED_ORIGINS) missingEnvVars.push('ALLOWED_ORIGINS');
}

if (missingEnvVars.length > 0) {
  console.error('='.repeat(60));
  console.error('FALTAN VARIABLES DE ENTORNO REQUERIDAS');
  console.error('='.repeat(60));
  missingEnvVars.forEach(key => {
    let hint = '';
    if (key === 'JWT_SECRET') hint = ' (generar con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"';
    else if (key === 'ADMIN_USER') hint = ' (ej: Iara)';
    else if (key === 'ADMIN_PASS_HASH') hint = ' (generar con: npx bcrypt-cli hash)';
    else if (key === 'DATABASE_URL') hint = ' (connection string de PostgreSQL)';
    else if (key === 'ALLOWED_ORIGINS') hint = ' (ej: https://tudominio.com,http://localhost:3000)';
    console.error(`  ${key} → requerido${hint}`);
  });
  console.error('='.repeat(60));
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', 'https://cdn.jsdelivr.net', 'https://cdn.vercel-insights.com', 'https://www.googletagmanager.com', '\'unsafe-inline\''],
      scriptSrcAttr: ['\'unsafe-inline\''],
      styleSrc: ['\'self\'', 'https://fonts.googleapis.com', '\'unsafe-inline\''],
      styleSrcAttr: ['\'unsafe-inline\''],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
      connectSrc: ['\'self\'', 'https://api.resend.com', 'https://vitals.vercel-insights.com', 'https://*.googleanalytics.com', 'https://*.google-analytics.com', 'https://stats.g.doubleclick.net'],
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

if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);
const defaultOrigins = [
  'https://iara-wz9o.vercel.app',
  'https://iara-lovat-orcin.vercel.app',
  'https://artesaniagualeguay.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173'
];
const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

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
app.use(require('cookie-parser')());
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

app.use((req, res, next) => {
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || crypto.randomUUID());
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'production') {
      logger.info({
        reqId: res.getHeader('X-Request-ID'),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration
      }, 'HTTP request');
    } else {
      logger.debug({
        reqId: res.getHeader('X-Request-ID'),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration
      }, 'HTTP request');
    }
  });
  next();
});

const TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 600000;
app.use((req, res, next) => {
  const isUploadRoute = /^\/api\/products\/\d+\/images/.test(req.path) ||
    req.path === '/api/admin/upload' ||
    (/^\/api\/admin\/products/.test(req.path) && req.method === 'POST') ||
    (req.path === '/api/admin/products/bulk-import');
  const isSyncRoute = req.path === '/api/sync';
  const timeoutMs = isUploadRoute ? UPLOAD_TIMEOUT_MS : (isSyncRoute ? 60000 : TIMEOUT_MS);
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
app.use('/api', require('./routes/siteSettings'));
app.use('/api', require('./routes/sitemap'));
app.use('/api', require('./routes/reviews'));
app.use('/api', require('./routes/productImages'));
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/receipts'));
app.use('/api', require('./routes/heroCards'));
app.use('/api/sync', require('./routes/sync'));

app.get('/metrics', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const allowedIps = (process.env.METRICS_ALLOWED_IPS || '').split(',').filter(Boolean);
  const metricsToken = process.env.METRICS_TOKEN;

  if (allowedIps.length && !allowedIps.some(ip => clientIp.startsWith(ip))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (metricsToken && req.headers['x-metrics-token'] !== metricsToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  res.json({
    uptime: process.uptime(),
    memory: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    nodeVersion: process.version,
    platform: process.platform
  });
});

app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    checks: {}
  };

  try {
    const { query } = require('./lib/db');
    await query('SELECT 1');
    health.checks.database = 'ok';
  } catch (err) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  health.checks.sentry = Sentry ? 'ok' : 'disabled';

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.get('/ready', async (req, res) => {
  try {
    const { query } = require('./lib/db');
    await query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready', reason: 'database' });
  }
});

app.post('/api/admin/upload', require('./middleware/auth').adminAuth, handleUploadError, uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    const processed = await processFile(req.file);
    res.json({
      url: getPublicUrl(processed.url),
      filename: processed.filename,
      size: req.file.size,
      isCloudinary: processed.isCloudinary
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error procesando imagen');
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
});

const isVercel = process.env.VERCEL === 'true';
const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;
const uploadsStaticDir = isVercel || isRender ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');

app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(uploadsStaticDir));
const staticDir = path.join(__dirname, '..', '..', 'frontend');

app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use(express.static(staticDir));

app.use('/api', limiter);

app.get('/sitemap.xml', require('./routes/sitemap'));

app.get('/*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use(notFound);

if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use(errorHandler);

const dbReady = initDB().then(async () => {
  logger.info('Base de datos inicializada correctamente');
  try {
    const { query } = require('./lib/db');
    const result = await query('SELECT COUNT(*) FROM users');
    if ((result.rows[0]?.count || 0) === 0 && process.env.ADMIN_USER && process.env.ADMIN_PASS_HASH) {
      await query(
        'INSERT INTO users (username, password_hash, role, permissions, active) VALUES ($1, $2, $3, $4, $5)',
        [process.env.ADMIN_USER, process.env.ADMIN_PASS_HASH, 'admin', JSON.stringify({ all: true }), true]
      );
      logger.info(`Usuario admin inicial creado: ${process.env.ADMIN_USER}`);
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo verificar/crear usuario admin inicial');
  }
}).catch(err => {
  logger.error({ err: err.message, stack: err.stack }, 'Error inicializando DB');
  console.error('Error inicializando DB:', err);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => logger.info(`Backend escuchando en puerto ${PORT}`));

  dbReady.catch(() => {});

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Puerto ${PORT} en uso. Usá PORT=${Number(PORT) + 1}`);
      process.exit(1);
    }
    throw err;
  });
} else {
  module.exports = { app, dbReady };
}
