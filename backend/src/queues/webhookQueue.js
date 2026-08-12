const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../lib/logger');

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  lazyConnect: true,
  enableReadyCheck: false,
});

const webhookQueue = new Queue('webhooks', { connection });

async function enqueueWebhook(payload) {
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
  const worker = new Worker('webhooks', handler, { connection });
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Webhook procesado');
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Webhook falló');
  });
  return worker;
}

module.exports = { webhookQueue, enqueueWebhook, startWebhookWorker };
