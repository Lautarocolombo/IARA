const Redis = require('ioredis');
const logger = require('./logger');

function isRedisUrlValid(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    const redisUrl = options.url || process.env.REDIS_URL;
    if (!isRedisUrlValid(redisUrl)) {
      throw new Error('REDIS_URL no configurada o inválida. Configurá la variable de entorno REDIS_URL en Render para habilitar rate limiting con Redis.');
    }

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(1000 * Math.pow(2, times), 30000);
        logger.warn(`[rate-limit] Reintentando conexión a Redis (intento ${times}, delay ${delay}ms)`);
        if (times >= 10) {
          logger.error('[rate-limit] Se agotaron los reintentos de conexión a Redis');
          return null;
        }
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: false,
    });

    this.redis.on('connect', () => {
      logger.info('[rate-limit] Redis conectado');
    });

    this.redis.on('error', (err) => {
      logger.warn('[rate-limit] Redis error:', err.message);
    });
  }

  async _key(key) {
    return this.prefix + key;
  }

  async incr(key) {
    const k = await this._key(key);
    const value = await this.redis.incr(k);
    if (value === 1) {
      await this.redis.pexpire(k, 900000);
    }
    return value;
  }

  async decrement(key) {
    const k = await this._key(key);
    const value = await this.redis.decr(k);
    return Math.max(0, value);
  }

  async resetKey(key) {
    const k = await this._key(key);
    await this.redis.del(k);
  }

  async resetAll() {
    const keys = await this.redis.keys(this.prefix + '*');
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }

  async quit() {
    await this.redis.quit();
  }
}

module.exports = RedisStore;
