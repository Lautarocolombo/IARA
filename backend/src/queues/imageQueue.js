const { Queue, Worker } = require('bullmq');
const redis = require('ioredis');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const logger = require('../lib/logger');

const redisUrl = process.env.REDIS_URL || '';
let redisConnection = null;
let imageQueue = null;
let workerInstance = null;

function getRedisConnection() {
  if (!redisUrl) {
    logger.warn('REDIS_URL no configurada, funcionando en modo síncrono');
    return null;
  }

  if (!redisConnection) {
    try {
      const normalizedUrl = redisUrl.replace(/^redis:\/\//, 'rediss://');
      redisConnection = new redis(normalizedUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(1000 * Math.pow(2, times), 30000);
          logger.warn({ attempt: times, delay }, 'Reintentando conexión a Redis');
          return delay;
        },
        keepAlive: true,
        connectTimeout: 10000,
        lazyConnect: true
      });

      redisConnection.on('connect', () => logger.info('Conectado a Redis'));
      redisConnection.on('error', (err) => logger.error({ err: err.message }, 'Error en conexión Redis'));
      redisConnection.on('close', () => logger.warn('Conexión Redis cerrada'));
      redisConnection.on('reconnecting', () => logger.info('Reconectando a Redis...'));
    } catch (err) {
      logger.error({ err: err.message }, 'Error creando conexión Redis');
    }
  }
  return redisConnection;
}

function getImageQueue() {
  if (!imageQueue && getRedisConnection()) {
    try {
      imageQueue = new Queue('image-processing', { connection: redisConnection });
    } catch (err) {
      logger.error({ err: err.message }, 'Error creando cola BullMQ');
    }
  }
  return imageQueue;
}

async function addImageProcessingJob(jobData) {
  const queue = getImageQueue();
  if (!queue) {
    logger.warn('Redis no disponible, job no encolado');
    return null;
  }

  try {
    const job = await queue.add('process-image', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: false
    });
    return job.id;
  } catch (err) {
    logger.error({ err: err.message }, 'Error encolando job');
    return null;
  }
}

async function startImageWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis no disponible, worker de imágenes no iniciado');
    return;
  }

  try {
    workerInstance = new Worker('image-processing', async (job) => {
      const { type, filePath, options = {} } = job.data;

      try {
        switch (type) {
          case 'optimize': {
            const optimizedPath = await optimizeImage(filePath);
            return { success: true, path: optimizedPath };
          }

          case 'watermark': {
            const watermarkedPath = await applyWatermark(filePath, options.watermark);
            return { success: true, path: watermarkedPath };
          }

          case 'variant': {
            const variants = await generateVariants(filePath);
            return { success: true, variants };
          }

          case 'transform': {
            const transformedPath = await transformImage(filePath, options);
            return { success: true, path: transformedPath };
          }

          case 'remove-bg': {
            const noBgPath = await removeBackground(filePath, options.apiKey);
            return { success: true, path: noBgPath };
          }

          default:
            throw new Error(`Tipo de job desconocido: ${type}`);
        }
      } catch (err) {
        logger.error({ err: err.message, jobId: job.id }, 'Error procesando imagen en cola');
        throw err;
      }
    }, { connection });

    workerInstance.on('completed', (job) => {
      logger.info({ jobId: job.id, type: job.data.type }, 'Job de imagen completado');
    });

    workerInstance.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err: err?.message }, 'Job de imagen falló');
    });

    logger.info('Worker de procesamiento de imágenes iniciado');
  } catch (err) {
    logger.error({ err: err.message }, 'Error iniciando worker de imágenes');
  }
}

async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const optimizedPath = filePath.replace(ext, '.webp');
  await sharp(filePath)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(optimizedPath);
  if (optimizedPath !== filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return optimizedPath;
}

async function applyWatermark(filePath, watermark) {
  if (!watermark?.text) return filePath;

  const metadata = await sharp(filePath).metadata();
  const fontSize = Math.max(12, Math.round(metadata.width * ((watermark.size || 10) / 100)));

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <style>
        .watermark { font-family: Arial, sans-serif; font-size: ${fontSize}px; fill: #FFFFFF; opacity: ${watermark.opacity ?? 0.3}; font-weight: bold; }
      </style>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="watermark" transform="rotate(-25 ${metadata.width/2} ${metadata.height/2})">${watermark.text}</text>
    </svg>
  `;

  const watermarkedPath = filePath.replace(/(\.\w+)$/, '_watermarked$1');
  await sharp(filePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .toFile(watermarkedPath);

  return watermarkedPath;
}

async function generateVariants(filePath) {
  const variants = {};
  const sizes = [
    { key: 'thumbnail', width: 150, height: 150 },
    { key: 'catalog', width: 400, height: 400 },
    { key: 'zoom', width: 1200, height: 1200 }
  ];

  for (const size of sizes) {
    const variantPath = filePath.replace(/(\.\w+)$/, `_${size.key}$1`);
    await sharp(filePath)
      .resize(size.width, size.height, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(variantPath);
    variants[size.key] = variantPath;
  }

  return variants;
}

async function transformImage(filePath, options) {
  let pipeline = sharp(filePath);

  if (options.crop) {
    pipeline = pipeline.extract({
      left: Math.max(0, Math.round(options.crop.x || 0)),
      top: Math.max(0, Math.round(options.crop.y || 0)),
      width: Math.round(options.crop.width),
      height: Math.round(options.crop.height)
    });
  }

  pipeline = pipeline.rotate(Number(options.rotate) || 0);

  if (options.flipH) pipeline = pipeline.flip();
  if (options.flipV) pipeline = pipeline.flop();

  const normalize = (val) => Math.max(0, Math.min(200, Number(val) || 100));
  pipeline = pipeline.modulate({
    brightness: normalize(options.brightness) / 100,
    saturation: normalize(options.saturation) / 100
  });

  pipeline = pipeline.resize(1200, 1200, { fit: 'inside', withoutEnlargement: true });

  const outputPath = filePath.replace(/(\.\w+)$/, '_edited$1');
  await pipeline.webp({ quality: 80 }).toFile(outputPath);
  return outputPath;
}

async function removeBackground(filePath, apiKey) {
  if (!apiKey) throw new Error('API key de remove.bg no configurada');

  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('image_file', fs.createReadStream(filePath));
  form.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`remove.bg error: ${response.status} ${errText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const outputPath = filePath.replace(/(\.\w+)$/, '_nobg.png');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function closeQueue() {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (imageQueue) {
    await imageQueue.close();
    imageQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

module.exports = {
  getImageQueue,
  addImageProcessingJob,
  startImageWorker,
  closeQueue
};
