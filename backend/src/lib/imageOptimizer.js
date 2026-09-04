const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('./logger');

const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_WEBP_QUALITY = 80;
const DEFAULT_AVIF_QUALITY = 60;

async function optimizeImage(filePath, options = {}) {
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const webpQuality = options.webpQuality || DEFAULT_WEBP_QUALITY;
  const avifQuality = options.avifQuality || DEFAULT_AVIF_QUALITY;
  const outputFormat = options.format || 'webp';

  const ext = path.extname(filePath).toLowerCase();
  const alreadyOptimized = ['.webp', '.avif'].includes(ext);

  if (alreadyOptimized && outputFormat === ext.slice(1)) {
    return filePath;
  }

  const baseName = path.basename(filePath, ext);
  const optimizedPath = path.join(path.dirname(filePath), `${baseName}.${outputFormat}`);

  try {
    let pipeline = sharp(filePath).rotate();

    const metadata = await sharp(filePath).metadata();
    const longestSide = Math.max(metadata.width || 0, metadata.height || 0);

    if (longestSide > maxDimension) {
      pipeline = pipeline.resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    pipeline = pipeline.withMetadata(false);

    if (outputFormat === 'avif') {
      pipeline = pipeline.avif({ quality: avifQuality });
    } else {
      pipeline = pipeline.webp({ quality: webpQuality });
    }

    await pipeline.toFile(optimizedPath);

    if (optimizedPath !== filePath && fs.existsSync(filePath)) {
      try {
        fs.rmSync(filePath, { force: true, maxRetries: 3, retryDelay: 50 });
      } catch (e) { /* noop */ }
    }

    return optimizedPath;
  } catch (err) {
    logger.warn({ err: err.message, stack: err.stack, file: filePath }, 'Sharp: error en optimización, usando archivo original');
    try {
      fs.rmSync(optimizedPath, { force: true, maxRetries: 3, retryDelay: 50 });
    } catch (e) { /* noop */ }
    return filePath;
  }
}

async function generateVariant(filePath, variantKey, variantsDir) {
  const VARIANTS = {
    thumbnail: { width: 150, height: 150, fit: 'cover' },
    catalog: { width: 400, height: 400, fit: 'cover' },
    zoom: { width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }
  };

  const config = VARIANTS[variantKey];
  if (!config) return null;

  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);
  const variantName = `${baseName}_${variantKey}.webp`;
  const variantPath = path.join(variantsDir, variantName);

  if (fs.existsSync(variantPath)) {
    return variantPath;
  }

  try {
    await sharp(filePath)
      .resize(config.width, config.height, {
        fit: config.fit,
        withoutEnlargement: config.withoutEnlargement || false
      })
      .webp({ quality: 80 })
      .withMetadata(false)
      .toFile(variantPath);

    return variantPath;
  } catch (err) {
    logger.warn({ err: err.message, variant: variantKey }, 'Sharp: error generando variante');
    return null;
  }
}

async function generateAllVariants(filePath, variantsDir) {
  const variants = {};
  const keys = ['thumbnail', 'catalog', 'zoom'];

  for (const key of keys) {
    variants[key] = await generateVariant(filePath, key, variantsDir);
  }

  return variants;
}

module.exports = {
  optimizeImage,
  generateVariant,
  generateAllVariants
};