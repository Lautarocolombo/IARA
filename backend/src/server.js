const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino');

dotenv.config({ override: false });

const { initDB } = require('./lib/db');
const { handleUploadError, processFile, uploadSingle, getPublicUrl } = require('./lib/upload');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/errorHandler');
const { tenantContext } = require('./middleware/tenant');
const { csrfProtection } = require('./middleware/csrf');
const { sanitizeBody } = require('./middleware/xssClean');
const { nonceMiddleware } = require('./middleware/nonce');
const { cspMiddleware } = require('./middleware/csp');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
    logger.warn('Sentry no disponible:', err.message);
  }
}

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
  logger.error('='.repeat(60));
  logger.error('FALTAN VARIABLES DE ENTORNO REQUERIDAS');
  logger.error('='.repeat(60));
  missingEnvVars.forEach(key => {
    let hint = '';
    if (key === 'JWT_SECRET') hint = ' (generar con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"';
    else if (key === 'ADMIN_USER') hint = ' (ej: Iara)';
    else if (key === 'ADMIN_PASS_HASH') hint = ' (generar con: npx bcrypt-cli hash)';
    else if (key === 'DATABASE_URL') hint = ' (connection string de PostgreSQL)';
    else if (key === 'ALLOWED_ORIGINS') hint = ' (ej: https://tudominio.com,http://localhost:3000)';
    logger.error(`  ${key} → requerido${hint}`);
  });
  logger.error('='.repeat(60));
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

app.use((req, res, next) => {
  if (req && req.get && req.headers) {
    const originalGet = req.get.bind(req);
    req.get = (name) => {
      if (name && name.toLowerCase() === 'host') {
        const host = (req.headers.host || '').split(':')[0];
        if (host) return host;
      }
      return originalGet(name);
    };
  }
  next();
});

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Nota: crossOriginEmbedderPolicy se mantiene en false porque el proyecto no usa
// SharedArrayBuffer ni features que lo requieran. Forzarlo a true podría romper
// la carga de recursos externos (Google Fonts, Analytics, Vercel Insights) si
// dichos CDNs no envían los headers CORS requeridos por COEP.

app.use(nonceMiddleware);
app.use(cspMiddleware);

if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeBody({ excludeKeys: ['about_text', 'hero_title'] }));
app.use(require('compression')());

const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);
const defaultOrigins = [
  'https://artesaniagualeguay.com',
  'https://www.artesaniagualeguay.com',
  'https://artesania-gualeguay.vercel.app',
  'https://artesania-gualeguay-v3.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

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

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed = isOriginAllowed(origin);
  const isPreflight = req.method === 'OPTIONS';

  if (isPreflight) {
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Accept-Language, Origin, X-Requested-With, X-Request-ID');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      logger.info('[CORS] Preflight respondido para:', { path: req.path, origin });
      return res.status(204).send();
    }
    logger.warn('[CORS] Preflight rechazado para:', { path: req.path, origin });
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  next();
});

const corsOptions = allowedOrigins.length
  ? {
      origin: function(origin, callback) {
        const allowed = isOriginAllowed(origin);
        logger.debug('[CORS] Preflight/request origin:', origin, 'allowed:', allowed, 'allowedOrigins:', allowedOrigins.join(','));
        callback(null, allowed);
      },
      credentials: true,
       methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
       allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With', 'X-Request-ID'],
   }
  : {
        origin: function(origin, callback) {
          if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With', 'X-Request-ID'],
    };

app.use(require('cookie-parser')());
app.use(tenantContext);
// app.options('*', cors(corsOptions)); // Reemplazado por middleware manual arriba para garantizar 204 en todas las rutas

let rateLimitStore = undefined;
if (process.env.REDIS_URL) {
  try {
    const RedisStore = require('./lib/redisStore');
    rateLimitStore = new RedisStore();
  } catch (err) {
    logger.warn('Redis store no disponible, usando memoria:', err.message);
  }
}
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  message: { error: 'Demasiados intentos de inicio de sesión, intentá de nuevo en 15 minutos' }
});
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  message: { error: 'Demasiados envíos de formulario, intentá de nuevo en una hora' }
});

const ordersLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  message: { error: 'Demasiadas solicitudes de pedidos, intentá de nuevo en unos minutos' }
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  message: { error: 'Demasiadas solicitudes al panel admin, intentá de nuevo en unos minutos' }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en unos minutos' }
});

app.use('/api', publicLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/orders', ordersLimiter);
app.use('/api/admin', adminLimiter);

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

app.use('/api', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return originalJson(body);
  };
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/auth'));
app.use('/api', require('./routes/products'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/payments'));
app.use('/api', require('./routes/paymentProofs'));
app.use('/api', require('./routes/siteTexts'));
app.use('/api', require('./routes/testimonials'));
app.use('/api', require('./routes/sectionContent'));
app.use('/api', require('./routes/newsletter'));
app.use('/api', require('./routes/contact'));
app.use('/api', require('./routes/siteConfig'));
app.use('/api', require('./routes/siteSettings'));
app.use('/api', require('./routes/shipping'));
app.use('/api', require('./routes/sitemap'));
app.use('/api', require('./routes/reviews'));
app.use('/api', require('./routes/productImages'));
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/receipts'));
app.use('/api', require('./routes/heroCards'));
app.use('/api', require('./routes/sales'));
app.use('/api', require('./routes/earnings'));
app.use('/api', require('./routes/carousel'));
app.use('/api/sync', require('./routes/sync'));

app.use('/api', tenantContext);
app.use('/api', csrfProtection);

app.use('/api/admin', require('./routes/coupons'));
app.use('/api/admin/inventory', require('./routes/inventory'));

app.get('/metrics', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const allowedIps = (process.env.METRICS_ALLOWED_IPS || '').split(',').filter(Boolean);
  const metricsToken = process.env.METRICS_TOKEN;

  if (allowedIps.length && !allowedIps.some(ip => clientIp.startsWith(ip))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!metricsToken || req.headers['x-metrics-token'] !== metricsToken) {
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

let gitCommit = '';
try {
  gitCommit = require('child_process').execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
  gitCommit = 'unknown';
}

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

  res.setHeader('X-Commit', gitCommit);
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
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    logger.debug('[Upload] CORS origin recibido:', origin);
    logger.debug('[Upload] Access-Control-Allow-Origin enviado:', res.getHeader('Access-Control-Allow-Origin'));
    if (!req.file) {
      logger.warn('[Upload] No se recibió imagen en /api/admin/upload');
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    logger.info('[Upload] Procesando imagen:', { filename: req.file.originalname, size: req.file.size });
    const processed = await processFile(req.file, `${req.protocol}://${req.get('host')}`);
    logger.info('[Upload] Imagen procesada OK:', { url: processed.url });
    const publicUrl = getPublicUrl(processed.url, `${req.protocol}://${req.get('host')}`);
    if (isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.json({
      url: publicUrl,
      filename: processed.filename,
      size: req.file.size,
      isCloudinary: processed.isCloudinary
    });
  } catch (err) {
    logger.error('[Upload] Error procesando imagen:', { message: err.message, stack: err.stack });
    logger.error('[Upload] Error completo:', { name: err.name, message: err.message, stack: err.stack, code: err.code });
    const message = err.message || 'Error al procesar la imagen';
    res.status(500).json({ error: message });
  }
});

const isVercel = process.env.VERCEL === 'true';
const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;
const isEphemeralProd = !isVercel && process.env.NODE_ENV === 'production';
const uploadsStaticDir = path.join(__dirname, '..', '..', 'uploads');

const UPLOAD_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="Imagen no disponible"><rect width="200" height="200" rx="14" fill="#fde8ef"/><text x="100" y="110" text-anchor="middle" font-family="system-ui,serif" font-size="40" fill="#d47090">📷</text><text x="100" y="150" text-anchor="middle" font-family="system-ui,serif" font-size="14" fill="#d47090">Imagen no disponible</text></svg>`;

app.use('/uploads', cors(corsOptions), (req, res, next) => {
  const relativePath = req.path.replace(/^\//, '');
  const filePath = path.join(uploadsStaticDir, relativePath);
  res.sendFile(filePath, { maxAge: '7d', etag: true, lastModified: true }, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(200).send(UPLOAD_PLACEHOLDER_SVG);
      }
      next();
    }
  });
});
const staticDir = path.join(__dirname, '..', '..', 'frontend');

app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use(express.static(staticDir, { maxAge: '1h', etag: true, lastModified: true }));

app.use((req, res, next) => {
  if (res.getHeader('Content-Type')?.includes('text/html') && !res.getHeader('Content-Type')?.includes('charset')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  next();
});

app.get('/sitemap.xml', require('./routes/sitemap'));

app.get('/*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  if (req.path.startsWith('/uploads/')) {
    return res.status(404).json({ error: 'Image not found' });
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
      try {
        await query(
          'INSERT INTO users (username, password_hash, role, permissions, active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING',
          [process.env.ADMIN_USER, process.env.ADMIN_PASS_HASH, 'admin', JSON.stringify({ all: true }), true]
        );
      } catch (err) {
        if (!err.message.includes('UNIQUE constraint failed') && !err.message.includes('duplicate key')) {
          throw err;
        }
      }
      logger.info(`Usuario admin inicial creado: ${process.env.ADMIN_USER}`);
    } else if (process.env.ADMIN_USER && process.env.ADMIN_PASS_HASH) {
      const existing = await query('SELECT password_hash, permissions FROM users WHERE username = $1', [process.env.ADMIN_USER]);
      if (existing.rows.length > 0) {
        const needsUpdate = existing.rows[0].password_hash !== process.env.ADMIN_PASS_HASH || existing.rows[0].permissions !== JSON.stringify({ all: true });
        if (needsUpdate) {
          await query('UPDATE users SET password_hash = $1, permissions = $2, updated_at = CURRENT_TIMESTAMP WHERE username = $3', [process.env.ADMIN_PASS_HASH, JSON.stringify({ all: true }), process.env.ADMIN_USER]);
          logger.info(`Hash/permisos de admin actualizados para: ${process.env.ADMIN_USER}`);
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo verificar/crear usuario admin inicial');
  }
}).catch(err => {
  logger.error({ err: err.message, stack: err.stack }, 'Error inicializando DB');
});

if (process.env.REDIS_URL) {
  try {
    const { startWebhookWorker } = require('./queues/webhookQueue');
    const { processWebhookSync } = require('./controllers/paymentController');
    startWebhookWorker(async (job) => {
      await processWebhookSync(job.data);
    });
    logger.info('Webhook worker iniciado');
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo iniciar webhook worker');
  }
}

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
