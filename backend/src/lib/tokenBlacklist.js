const logger = require('./logger');

let redisClient = null;
let useRedis = false;
const JWT_TTL_MS = 15 * 60 * 1000;

async function getRedis() {
  if (redisClient) return redisClient;
  if (useRedis === false) return null;
  if (process.env.NODE_ENV === 'test') return null;

  try {
    const Redis = require('ioredis');
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      useRedis = false;
      return null;
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableReadyCheck: false,
    });

    redisClient.on('connect', () => {
      logger.info('[tokenBlacklist] Redis conectado');
    });

    redisClient.on('error', (err) => {
      logger.warn('[tokenBlacklist] Redis error:', err.message);
    });

    await redisClient.connect();
    useRedis = true;
    return redisClient;
  } catch (err) {
    logger.warn('[tokenBlacklist] No se pudo conectar a Redis, usando fallback en memoria:', err.message);
    useRedis = false;
    redisClient = null;
    return null;
  }
}

const memoryBlacklist = new Set();
let cleanupTimeout = null;

function scheduleMemoryCleanup() {
  if (cleanupTimeout) return;
  cleanupTimeout = setTimeout(() => {
    memoryBlacklist.clear();
    cleanupTimeout = null;
  }, JWT_TTL_MS);
}

async function add(token) {
  if (!token || typeof token !== 'string') return;

  const redis = await getRedis();
  if (redis && useRedis) {
    try {
      await redis.setex('token_blacklist:' + token, Math.floor(JWT_TTL_MS / 1000), '1');
      return;
    } catch (err) {
      logger.warn('[tokenBlacklist] Error en Redis setex, fallback a memoria:', err.message);
      useRedis = false;
    }
  }

  memoryBlacklist.add(token);
  scheduleMemoryCleanup();
}

async function has(token) {
  if (!token || typeof token !== 'string') return false;

  const redis = await getRedis();
  if (redis && useRedis) {
    try {
      const exists = await redis.exists('token_blacklist:' + token);
      return exists === 1;
    } catch (err) {
      logger.warn('[tokenBlacklist] Error en Redis exists, fallback a memoria:', err.message);
      useRedis = false;
    }
  }

  return memoryBlacklist.has(token);
}

process.on('exit', () => {
  if (cleanupTimeout) clearTimeout(cleanupTimeout);
  memoryBlacklist.clear();
  if (redisClient) {
    try { redisClient.quit(); } catch (e) { /* noop */ }
  }
});

module.exports = {
  add,
  has
};
