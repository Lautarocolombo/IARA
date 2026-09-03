/* eslint-env jest */
const fs = require('fs');
const path = require('path');
const os = require('os');

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn()
}));

const { put, del } = require('@vercel/blob');
const upload = require('../src/lib/upload');

function makeTmpFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blob-test-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_PNG_BASE64, 'base64'));
  return { filePath, dir };
}

describe('Vercel Blob helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterAll(() => {
    const dirs = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('blob-test-'));
    dirs.forEach(d => {
      const full = path.join(os.tmpdir(), d);
      if (fs.existsSync(full)) {
        try {
          fs.rmSync(full, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        } catch (e) {
          try {
            const { execSync } = require('child_process');
            execSync(`rm -rf ${JSON.stringify(full)}`, { stdio: 'ignore' });
          } catch (e) {
            // noop
          }
        }
      }
    });
  });

  test('isBlobUrl clasifica correctamente', () => {
    expect(upload.isBlobUrl('https://proyecto.blob.vercel-storage.com/products/123.webp')).toBe(true);
    expect(upload.isBlobUrl('https://res.cloudinary.com/demo/a.jpg')).toBe(false);
    expect(upload.isBlobUrl('data:image/png;base64,abc')).toBe(false);
    expect(upload.isBlobUrl('/uploads/products/a.jpg')).toBe(false);
    expect(upload.isBlobUrl('')).toBe(false);
    expect(upload.isBlobUrl(null)).toBe(false);
  });

  test('isBlobConfigured rechaza tokens vacíos o con formato inválido', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(upload.isBlobConfigured()).toBe(false);
    process.env.BLOB_READ_WRITE_TOKEN = '';
    expect(upload.isBlobConfigured()).toBe(false);
    process.env.BLOB_READ_WRITE_TOKEN = 'token-invalido';
    expect(upload.isBlobConfigured()).toBe(false);
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_token_valido';
    expect(upload.isBlobConfigured()).toBe(true);
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  test('processFile siempre guarda como base64 en Neon', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_test_token';
    const { filePath: tmpFile } = makeTmpFile('test.png');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.isBase64).toBe(true);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
    expect(put).not.toHaveBeenCalled();
  });

  test('processFile guarda base64 en dev cuando no hay token de Blob', async () => {
    const { filePath: tmpFile } = makeTmpFile('test2.png');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test2.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.isBase64).toBe(true);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
    expect(put).not.toHaveBeenCalled();
  });

  test('processFile guarda base64 en producción', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const { filePath: tmpFile } = makeTmpFile('test3.png');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test3.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.isBase64).toBe(true);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
    expect(put).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalNodeEnv;
  });

  test('processFile guarda base64 cuando falla subida a Blob', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_test_token';

    put.mockRejectedValue(new Error('Blob upload failed'));

    const { filePath: tmpFile } = makeTmpFile('test-fallback.png');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test-fallback.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.isBase64).toBe(true);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
    expect(put).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  test('processFile borra el archivo optimizado al guardar base64', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const { filePath: tmpFile } = makeTmpFile('test4.png');
    const optimizedPath = path.join(path.dirname(tmpFile), 'test4.webp');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test4.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.isBase64).toBe(true);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
    expect(fs.existsSync(optimizedPath)).toBe(false);
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }

    process.env.NODE_ENV = originalNodeEnv;
  });

  test('processFile borra archivos temporales en dev al guardar base64', async () => {
    const { filePath: tmpFile } = makeTmpFile('test5.png');
    const optimizedPath = path.join(path.dirname(tmpFile), 'test5.webp');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test5.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.isBase64).toBe(true);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
    expect(fs.existsSync(optimizedPath)).toBe(false);
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  test('deleteFromBlob ignora URLs que no son de Blob', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const r = await upload.deleteFromBlob('https://res.cloudinary.com/demo/a.jpg');
    expect(r).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  test('deleteFromBlob borra cuando la URL es de Blob y el token está seteado', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_test_token';
    del.mockResolvedValue();
    const r = await upload.deleteFromBlob('https://proyecto.blob.vercel-storage.com/products/x.png');
    expect(r).toBe(true);
    expect(del).toHaveBeenCalledWith('https://proyecto.blob.vercel-storage.com/products/x.png', { token: 'vercel_blob_test_token' });
  });
});
