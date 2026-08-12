const Redis = require('ioredis');

class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.redis = new Redis({
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT || '6379', 10),
      password: options.password || process.env.REDIS_PASSWORD || undefined,
      db: options.db || parseInt(process.env.REDIS_DB || '0', 10),
      lazyConnect: true,
      enableReadyCheck: false,
    });

    this.redis.on('connect', () => {
      console.log('[rate-limit] Redis conectado');
    });

    this.redis.on('error', (err) => {
      console.warn('[rate-limit] Redis error:', err.message);
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
