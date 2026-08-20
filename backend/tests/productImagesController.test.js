jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  getPublicUrl: jest.fn((url) => url || ''),
  deleteImageAsset: jest.fn().mockResolvedValue(true),
  processFile: jest.fn().mockResolvedValue({ url: 'http://localhost/uploads/processed.webp', filename: 'processed.webp', cloudinary_public_id: 'cloud-id' })
}));

const { query } = require('../src/lib/db');
const {
  getProductImages,
  uploadProductImages,
  updateProductImage,
  deleteProductImage,
  replaceProductImage,
  syncProductImages
} = require('../src/controllers/productImagesController');

describe('productImagesController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getProductImages', () => {
    test('retorna imágenes del producto', async () => {
      const req = { params: { id: '1' }, protocol: 'http', get: () => 'localhost' };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, url: '/uploads/img.webp' }] });

      await getProductImages(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    });

    test('maneja error de base de datos', async () => {
      const req = { params: { id: '1' }, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getProductImages(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('uploadProductImages', () => {
    test('sube imágenes desde URLs y archivos', async () => {
      const req = {
        params: { id: '1' },
        body: { imageUrls: JSON.stringify(['http://example.com/img1.jpg']), descripcion: 'Test', categoria: 'pulseras' },
        files: [{ path: '/tmp/img.jpg', mimetype: 'image/jpeg' }],
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ max_orden: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'http://example.com/img1.jpg' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 2, url: 'http://localhost/uploads/processed.webp' }] });

      await uploadProductImages(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, images: expect.any(Array) }));
    });

    test('retorna 400 si supera el límite de 5 imágenes', async () => {
      const req = {
        params: { id: '1' },
        body: { imageUrls: JSON.stringify(['http://example.com/img1.jpg', 'http://example.com/img2.jpg']) },
        files: [{ path: '/tmp/img.jpg', mimetype: 'image/jpeg' }],
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ count: 4 }] });

      await uploadProductImages(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Máximo 5 imágenes por producto' });
    });

    test('retorna 404 si el producto no existe', async () => {
      const req = {
        params: { id: '999' },
        body: {},
        files: [],
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await uploadProductImages(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('maneja error de base de datos', async () => {
      const req = {
        params: { id: '1' },
        body: {},
        files: [],
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await uploadProductImages(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProductImage', () => {
    test('actualiza imagen exitosamente', async () => {
      const req = {
        params: { id: '1', imageId: '1' },
        body: { es_principal: false, orden: 1, descripcion: 'Nueva desc', categoria: 'anillos' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, url: '/uploads/img.webp', es_principal: false, descripcion: 'Nueva desc', categoria: 'anillos' }] });

      await updateProductImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, descripcion: 'Nueva desc' }));
    });

    test('retorna 404 si la imagen no existe', async () => {
      const req = {
        params: { id: '1', imageId: '999' },
        body: {},
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateProductImage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si no hay datos para actualizar', async () => {
      const req = {
        params: { id: '1', imageId: '1' },
        body: {},
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await updateProductImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteProductImage', () => {
    test('elimina imagen y re-sincroniza principal', async () => {
      const req = {
        params: { id: '1', imageId: '1' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, url: '/uploads/img.webp', es_principal: true }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 2, url: '/uploads/img2.webp', es_principal: false }] });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteProductImage(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si la imagen no existe', async () => {
      const req = {
        params: { id: '1', imageId: '999' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteProductImage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('replaceProductImage', () => {
    test('reemplaza imagen exitosamente', async () => {
      const req = {
        params: { id: '1', imageId: '1' },
        file: { path: '/tmp/new-img.jpg', mimetype: 'image/jpeg' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, url: '/uploads/old.webp' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'http://localhost/uploads/processed.webp', filename: 'processed.webp' }] });

      await replaceProductImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, url: 'http://localhost/uploads/processed.webp' }));
    });

    test('retorna 404 si la imagen no existe', async () => {
      const req = {
        params: { id: '1', imageId: '999' },
        file: {},
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await replaceProductImage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si falta el archivo', async () => {
      const req = {
        params: { id: '1', imageId: '1' },
        file: null,
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await replaceProductImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('syncProductImages', () => {
    test('sincroniza orden de imágenes', async () => {
      const req = {
        params: { id: '1' },
        body: { orden: JSON.stringify([2, 1, 3]) },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await syncProductImages(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenCalledTimes(3);
    });

    test('retorna 400 si no se proporciona array de órdenes', async () => {
      const req = {
        params: { id: '1' },
        body: { orden: 'invalid' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await syncProductImages(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
