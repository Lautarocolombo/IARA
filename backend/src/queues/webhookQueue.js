const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../lib/logger');

const redisUrl = process.env.REDIS_URL;
let connection = null;
let webhookQueue = null;
let workerInstance = null;

function getRedisConnection() {
  if (!redisUrl) {
    return null;
  }

  if (!connection) {
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(1000 * Math.pow(2, times), 30000);
        logger.warn({ attempt: times, delay }, 'Reintentando conexión a Redis (webhookQueue)');
        if (times >= 10) {
          logger.error('Se agotaron los reintentos de conexión a Redis (webhookQueue)');
          return null;
        }
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: false,
    });

    connection.on('connect', () => logger.info('Conectado a Redis (webhookQueue)'));
    connection.on('error', (err) => logger.error({ err: err.message }, 'Error en conexión Redis (webhookQueue)'));
    connection.on('close', () => logger.warn('Conexión Redis cerrada (webhookQueue)'));
    connection.on('reconnecting', () => logger.info('Reconectando a Redis... (webhookQueue)'));
  }
  return connection;
}

if (getRedisConnection()) {
  webhookQueue = new Queue('webhooks', { connection });
}

async function enqueueWebhook(payload) {
  if (!webhookQueue) {
    logger.warn('REDIS_URL no configurada, webhook no encolado (modo degradado)');
    return { id: 'local-' + Date.now() };
  }

  try {
    const job = await webhookQueue.add('process-webhook', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    return job.id;
  } catch (err) {
    logger.error({ err: err.message }, 'Error encolando webhook');
    throw err;
  }
}

async function startWebhookWorker(handler) {
  if (!getRedisConnection()) {
    logger.warn('REDIS_URL no configurada, worker de webhooks no iniciado (modo degradado)');
    return null;
  }

  workerInstance = new Worker('webhooks', handler, { connection });
  workerInstance.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Webhook procesado');
  });
  workerInstance.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Webhook falló');
  });
  return workerInstance;
}

module.exports = { webhookQueue, enqueueWebhook, startWebhookWorker };
