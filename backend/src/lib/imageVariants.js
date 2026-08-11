const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('./logger');

const isVercel = process.env.VERCEL === 'true';
const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;
const variantsDir = isVercel || isRender ? '/tmp/uploads/products/variants' : path.join(__dirname, '..', '..', 'uploads', 'products', 'variants');

if (!fs.existsSync(variantsDir)) {
  try {
    fs.mkdirSync(variantsDir, { recursive: true });
  } catch (err) {
    logger.error('Error creando directorio de variantes:', err.message);
  }
}

const VARIANTS = {
  thumbnail: { width: 150, height: 150, fit: 'cover', name: 'thumb' },
  catalog: { width: 400, height: 400, fit: 'cover', name: 'catalog' },
  zoom: { width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true, name: 'zoom' }
};

async function generateVariant(filePath, variantKey) {
  const config = VARIANTS[variantKey];
  if (!config) return null;

  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);
  const variantName = `${baseName}_${config.name}.webp`;
  const variantPath = path.join(variantsDir, variantName);

  if (fs.existsSync(variantPath)) {
    return variantPath;
  }

  try {
    const transform = sharp(filePath).resize(config.width, config.height, {
      fit: config.fit,
      withoutEnlargement: config.withoutEnlargement || false
    }).webp({ quality: 80 });

    await transform.toFile(variantPath);
    return variantPath;
  } catch (err) {
    logger.warn({ err: err.message, variant: variantKey }, 'Error generando variante');
    return null;
  }
}

async function generateAllVariants(filePath) {
  const variants = {};
  for (const key of Object.keys(VARIANTS)) {
    variants[key] = await generateVariant(filePath, key);
  }
  return variants;
}

function getVariantUrl(originalUrl, cloudinaryPublicId, variantKey, baseUrl, watermark) {
  const config = VARIANTS[variantKey];
  if (!config) return originalUrl;

  if (cloudinaryPublicId) {
    const wmUrl = getWatermarkedUrl(originalUrl, cloudinaryPublicId, watermark, variantKey);
    if (wmUrl) return wmUrl;

    const transform = `c_fill,w_${config.width},h_${config.height}/f_webp,q_auto`;
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${cloudinaryPublicId}`;
  }

  if (!originalUrl) return '';

  const resolvedBaseUrl = baseUrl || process.env.BACKEND_URL || process.env.SITE_URL || '';
  if (originalUrl.startsWith('http')) {
    const url = new URL(originalUrl);
    const parts = url.pathname.split('/');
    const filename = parts.pop();
    const base = parts.join('/');
    return `${url.origin}${base}/variants/${path.basename(filename, path.extname(filename))}_${config.name}.webp`;
  }

  const filename = path.basename(originalUrl);
  const base = path.dirname(originalUrl);
  return `${resolvedBaseUrl}${base}/variants/${path.basename(filename, path.extname(filename))}_${config.name}.webp`;
}

function getSrcSet(originalUrl, cloudinaryPublicId, baseUrl, watermark) {
  const sizes = [
    { key: 'thumbnail', width: 150 },
    { key: 'catalog', width: 400 },
    { key: 'zoom', width: 1200 }
  ];

  return sizes
    .map(s => `${getVariantUrl(originalUrl, cloudinaryPublicId, s.key, baseUrl, watermark)} ${s.width}w`)
    .join(', ');
}

function getSizesAttr(variantKey) {
  const map = {
    thumbnail: '150px',
    catalog: '400px',
    zoom: '1200px'
  };
  return map[variantKey] || '100vw';
}

function getWatermarkedUrl(originalUrl, cloudinaryPublicId, watermark, variantKey = 'catalog') {
  if (!cloudinaryPublicId || !watermark?.texto) return null;

  const config = VARIANTS[variantKey] || VARIANTS.catalog;
  const w = config.width;
  const h = config.height;

  const positionMap = {
    center: 'center',
    'top-left': 'north_west',
    'top-right': 'north_east',
    'bottom-left': 'south_west',
    'bottom-right': 'south_east'
  };
  const gravity = positionMap[watermark.watermark_posicion] || 'center';
  const opacity = Math.round((watermark.watermark_opacidad ?? 0.3) * 100);
  const fontSize = Math.max(12, Math.round(w * ((watermark.watermark_tamano ?? 10) / 100)));

  const textLayer = encodeURIComponent(watermark.watermark_texto);
  const transform = `c_fill,w_${w},h_${h}/l_text:Arial_${fontSize}:${textLayer},g_${gravity},o_${opacity},x_0,y_0`;

  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${cloudinaryPublicId}`;
}

module.exports = {
  generateAllVariants,
  generateVariant,
  getVariantUrl,
  getSrcSet,
  getSizesAttr,
  getWatermarkedUrl,
  VARIANTS
};
