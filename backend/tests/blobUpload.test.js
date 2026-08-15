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
  const dir = path.join(os.tmpdir(), 'blob-test');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_PNG_BASE64, 'base64'));
  return filePath;
}

describe('Vercel Blob helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterAll(() => {
    const dir = path.join(os.tmpdir(), 'blob-test');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('isBlobUrl clasifica correctamente', () => {
    expect(upload.isBlobUrl('https://proyecto.blob.vercel-storage.com/products/123.webp')).toBe(true);
    expect(upload.isBlobUrl('https://res.cloudinary.com/demo/a.jpg')).toBe(false);
    expect(upload.isBlobUrl('data:image/png;base64,abc')).toBe(false);
    expect(upload.isBlobUrl('/uploads/products/a.jpg')).toBe(false);
    expect(upload.isBlobUrl('')).toBe(false);
    expect(upload.isBlobUrl(null)).toBe(false);
  });

  test('processFile sube a Vercel Blob cuando BLOB_READ_WRITE_TOKEN está configurado', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'token-falso-para-test';
    const tmpFile = makeTmpFile('test.png');

    put.mockResolvedValue({ url: 'https://proyecto.blob.vercel-storage.com/products/x.png' });

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(true);
    expect(result.url).toBe('https://proyecto.blob.vercel-storage.com/products/x.png');
    expect(put).toHaveBeenCalledTimes(1);
    const [name, buffer, opts] = put.mock.calls[0];
    expect(name).toMatch(/^products\/\d+_test\.png$/);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(opts.contentType).toBe('image/webp');
    expect(opts.access).toBe('public');
    expect(opts.token).toBe('token-falso-para-test');
  });

  test('processFile usa fallback con URL local cuando no hay token de Blob', async () => {
    const tmpFile = makeTmpFile('test2.png');

    const result = await upload.processFile({
      path: tmpFile,
      originalname: 'test2.png',
      mimetype: 'image/png',
      size: Buffer.from(TINY_PNG_BASE64, 'base64').length
    });

    expect(result.isBlob).toBe(false);
    expect(result.url).toMatch(/^http:\/\/localhost:10000\/uploads\/imagenes\/test2\.webp$/);
    expect(put).not.toHaveBeenCalled();
  });

  test('processFile lanza error claro en producción si no hay Blob configurado', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const tmpFile = makeTmpFile('test3.png');

    await expect(
      upload.processFile({
        path: tmpFile,
        originalname: 'test3.png',
        mimetype: 'image/png',
        size: Buffer.from(TINY_PNG_BASE64, 'base64').length
      })
    ).rejects.toThrow('Storage de imágenes no configurado');

    process.env.NODE_ENV = originalNodeEnv;
  });

  test('deleteFromBlob ignora URLs que no son de Blob', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const r = await upload.deleteFromBlob('https://res.cloudinary.com/demo/a.jpg');
    expect(r).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  test('deleteFromBlob borra cuando la URL es de Blob y el token está seteado', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'token-falso-para-test';
    del.mockResolvedValue();
    const r = await upload.deleteFromBlob('https://proyecto.blob.vercel-storage.com/products/x.png');
    expect(r).toBe(true);
    expect(del).toHaveBeenCalledWith('https://proyecto.blob.vercel-storage.com/products/x.png', { token: 'token-falso-para-test' });
  });
});
