/* eslint-env jest */
const fs = require('fs');
const path = require('path');
const os = require('os');

const { optimizeImage, generateVariant, generateAllVariants } = require('../src/lib/imageOptimizer');

const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'image-optimizer-test-'));

function makeTmpFile(name, content) {
  const filePath = path.join(TEST_DIR, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterAll(() => {
  cleanup();
});

describe('imageOptimizer', () => {
  test('optimizeImage convierte PNG a WebP', async () => {
    const input = makeTmpFile('input.png', Buffer.from(TINY_PNG_BASE64, 'base64'));
    const result = await optimizeImage(input, { format: 'webp' });

    expect(result).toMatch(/\.webp$/);
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.existsSync(input)).toBe(false);
  });

  test('optimizeImage respeta formato AVIF cuando se solicita', async () => {
    const input = makeTmpFile('input.jpg', Buffer.from(TINY_PNG_BASE64, 'base64'));
    const result = await optimizeImage(input, { format: 'avif' });

    expect(result).toMatch(/\.avif$/);
    expect(fs.existsSync(result)).toBe(true);
  });

  test('optimizeImage no re-encode si ya es WebP', async () => {
    const input = makeTmpFile('input.webp', Buffer.from(TINY_PNG_BASE64, 'base64'));
    const result = await optimizeImage(input, { format: 'webp' });

    expect(result).toBe(input);
  });

  test('optimizeImage retorna ruta original en error', async () => {
    const input = makeTmpFile('bad.txt', 'not an image');
    const result = await optimizeImage(input, { format: 'webp' });

    expect(result).toBe(input);
  });

  test('generateVariant crea variante thumbnail', async () => {
    const input = makeTmpFile('variant.png', Buffer.from(TINY_PNG_BASE64, 'base64'));
    const variantDir = path.join(TEST_DIR, 'variants');
    if (!fs.existsSync(variantDir)) fs.mkdirSync(variantDir, { recursive: true });

    const result = await generateVariant(input, 'thumbnail', variantDir);

    expect(result).toMatch(/thumbnail\.webp$/);
    expect(fs.existsSync(result)).toBe(true);
  });

  test('generateVariant retorna null para variante desconocida', async () => {
    const input = makeTmpFile('variant2.png', Buffer.from(TINY_PNG_BASE64, 'base64'));
    const result = await generateVariant(input, 'unknown', TEST_DIR);

    expect(result).toBeNull();
  });

  test('generateAllVariants crea thumbnail, catalog y zoom', async () => {
    const input = makeTmpFile('allvariants.png', Buffer.from(TINY_PNG_BASE64, 'base64'));
    const variantDir = path.join(TEST_DIR, 'variants2');
    if (!fs.existsSync(variantDir)) fs.mkdirSync(variantDir, { recursive: true });

    const result = await generateAllVariants(input, variantDir);

    expect(result.thumbnail).toMatch(/_thumbnail\.webp$/);
    expect(result.catalog).toMatch(/_catalog\.webp$/);
    expect(result.zoom).toMatch(/_zoom\.webp$/);
    expect(fs.existsSync(result.thumbnail)).toBe(true);
    expect(fs.existsSync(result.catalog)).toBe(true);
    expect(fs.existsSync(result.zoom)).toBe(true);
  });
});