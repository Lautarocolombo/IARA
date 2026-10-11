const crypto = require('crypto');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const logger = require('../lib/logger');

let redisClient = null;
let sessionMiddleware = null;

async function initSession() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    logger.info('[Session] REDIS_URL no configurado. Usando MemoryStore (solo desarrollo).');
    sessionMiddleware = session({
      secret: process.env.SESSION_SECRET || process.env.CSRF_SECRET || 'dev-secret-change-in-production',
      name: 'sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      }
    });
    return sessionMiddleware;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on('error', (err) => {
      logger.error({ err: err.message }, 'Redis client error');
    });
    
    redisClient.on('connect', () => {
      logger.info('[Session] Redis conectado');
    });
    
    await redisClient.connect();
    
    const redisStore = new RedisStore({
      client: redisClient,
      prefix: 'session:'
    });
    
    sessionMiddleware = session({
      store: redisStore,
      secret: process.env.SESSION_SECRET || process.env.CSRF_SECRET || 'dev-secret-change-in-production',
      name: 'sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      }
    });
    
    logger.info('[Session] RedisStore configurado correctamente');
    return sessionMiddleware;
  } catch (err) {
    logger.error({ err: err.message }, 'Error configurando Redis session, fallback a MemoryStore');
    sessionMiddleware = session({
      secret: process.env.SESSION_SECRET || process.env.CSRF_SECRET || 'dev-secret-change-in-production',
      name: 'sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      }
    });
    return sessionMiddleware;
  }
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware para generar/asegurar token CSRF en la sesión
function ensureCsrfToken(req, res, next) {
  // Saltar para endpoints de warm-up/health
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/v1/health') {
    return next();
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

module.exports = { initSession, getSessionMiddleware, closeSession, generateCsrfToken, ensureCsrfToken };

function getSessionMiddleware() {
  return sessionMiddleware;
}

async function closeSession() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('[Session] Redis desconectado');
    } catch (err) {
      logger.error({ err: err.message }, 'Error cerrando Redis session');
    }
  }
}

module.exports = { initSession, getSessionMiddleware, closeSession, generateCsrfToken, ensureCsrfToken };