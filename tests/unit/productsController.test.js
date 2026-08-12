/**
 * Tests unitarios para productsController.js (backend)
 * Cubre attachImagesToProducts y searchProducts
 */

jest.mock('../../backend/src/lib/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../backend/src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../../backend/src/lib/upload', () => ({
  getPublicUrl: jest.fn((p) => p),
  deleteImageAsset: jest.fn(),
}));

jest.mock('../../backend/src/lib/validators', () => ({
  productSchema: {
    parse: jest.fn((x) => x),
    safeParse: jest.fn((x) => ({ success: true, data: x })),
  },
}));

jest.mock('../../backend/src/routes/sync', () => ({
  syncBus: { emit: jest.fn() },
}));

const { query } = require('../../backend/src/lib/db');
const { getPublicUrl } = require('../../backend/src/lib/upload');
const controller = require('../../backend/src/controllers/productsController');
const { attachImagesToProducts, searchProducts } = controller;

describe('productsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPublicUrl.mockImplementation((p) => (p && p.startsWith('http') ? p : p || ''));
  });

  /* ==================== attachImagesToProducts ==================== */

  describe('attachImagesToProducts', () => {
    test('retorna array vacío para input null/undefined/empty', async () => {
      expect(await attachImagesToProducts(null, 'https://example.com')).toEqual([]);
      expect(await attachImagesToProducts([], 'https://example.com')).toEqual([]);
    });

    test('retorna products sin modificar si query de imágenes falla', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));
      const products = [{ id: 1, name: 'Test', image: '/uploads/img.jpg' }];
      const result = await attachImagesToProducts(products, 'https://example.com');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: 'Test' });
      expect(query).toHaveBeenCalledTimes(1);
    });

    test('usa batch query con IN clause (no N+1)', async () => {
      const products = [
        { id: 1, name: 'A', image: '' },
        { id: 2, name: 'B', image: '' },
        { id: 3, name: 'C', image: '' },
      ];
      query.mockResolvedValueOnce({ rows: [] });
      await attachImagesToProducts(products, 'https://example.com');

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('IN (');
      expect(sql).toContain('product_images');
      expect(params).toEqual([1, 2, 3]);
    });

    test('attachea imágenes y marca es_principal como image principal', async () => {
      const products = [{ id: 5, name: 'Pulsera', image: '' }];
      const imageRows = [
        { product_id: 5, url: '/uploads/img1.jpg', es_principal: true, orden: 1 },
        { product_id: 5, url: '/uploads/img2.jpg', es_principal: false, orden: 2 },
      ];
      query.mockResolvedValueOnce({ rows: imageRows });
      getPublicUrl.mockImplementation((url) => 'https://cdn.com' + url);

      const result = await attachImagesToProducts(products, 'https://example.com');

      expect(result).toHaveLength(1);
      expect(result[0].images).toHaveLength(2);
      expect(result[0].image).toBe('https://cdn.com/uploads/img1.jpg');
      expect(result[0].images[0].url).toBe('https://cdn.com/uploads/img1.jpg');
    });

    test('fallback a primera imagen cuando no hay es_principal', async () => {
      const products = [{ id: 7, name: 'Collar', image: '' }];
      const imageRows = [
        { product_id: 7, url: '/uploads/img2.jpg', es_principal: false, orden: 1 },
        { product_id: 7, url: '/uploads/img1.jpg', es_principal: false, orden: 2 },
      ];
      query.mockResolvedValueOnce({ rows: imageRows });
      getPublicUrl.mockImplementation((url) => 'https://cdn.com' + url);

      const result = await attachImagesToProducts(products, 'https://example.com');

      expect(result[0].image).toBe('https://cdn.com/uploads/img2.jpg');
    });

    test('fallback a p.image (legacy) cuando no hay imágenes', async () => {
      const products = [{ id: 9, name: 'Arete', image: '/uploads/legacy.jpg' }];
      query.mockResolvedValueOnce({ rows: [] });
      getPublicUrl.mockImplementation((url) => 'https://cdn.com' + url);

      const result = await attachImagesToProducts(products, 'https://example.com');

      expect(result[0].image).toBe('https://cdn.com/uploads/legacy.jpg');
      expect(result[0].images).toEqual([]);
    });

    test('retorna string vacío para image cuando no hay imágenes ni legacy', async () => {
      const products = [{ id: 10, name: 'Anillo', image: '' }];
      query.mockResolvedValueOnce({ rows: [] });

      const result = await attachImagesToProducts(products, 'https://example.com');

      expect(result[0].image).toBe('');
      expect(result[0].images).toEqual([]);
    });
  });

  /* ==================== searchProducts ==================== */

  describe('searchProducts', () => {
    function mockRes() {
      return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    }

    test('retorna array vacío cuando q está vacío', async () => {
      const req = { query: { q: '' } };
      const res = mockRes();
      await searchProducts(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
      expect(query).not.toHaveBeenCalled();
    });

    test('retorna array vacío cuando q es solo espacios', async () => {
      const req = { query: { q: '   ' } };
      const res = mockRes();
      await searchProducts(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('usa query parametrizada con $1 (SQLi safe)', async () => {
      const sqliPayload = '\'; DROP TABLE products; --';
      const req = { query: { q: sqliPayload }, protocol: 'https', get: () => 'localhost' };
      const res = mockRes();
      query.mockResolvedValueOnce({ rows: [] });

      await searchProducts(req, res);

      const [, params] = query.mock.calls[0];
      expect(query.mock.calls[0][0]).toContain('$1');
      expect(query.mock.calls[0][0]).not.toContain('DROP TABLE');
      expect(params).toEqual(['%' + sqliPayload + '%']);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('retorna productos enriquecidos con imágenes', async () => {
      const req = { query: { q: 'pulsera' }, protocol: 'https', get: () => 'localhost' };
      const res = mockRes();
      const dbRows = [
        { id: 1, name: 'Pulsera Rosa', active: true, deleted: false, image: '/uploads/pulsera.jpg' },
      ];
      const imageRows = [
        { product_id: 1, url: '/uploads/pulsera_detail.jpg', es_principal: true, orden: 1 },
      ];
      query
        .mockResolvedValueOnce({ rows: dbRows })
        .mockResolvedValueOnce({ rows: imageRows });

      await searchProducts(req, res);

      expect(query).toHaveBeenCalledTimes(2);
      const sendQuery = query.mock.calls[0];
      const imgQuery = query.mock.calls[1];

      expect(sendQuery[0]).toContain('SELECT * FROM products');
      expect(sendQuery[0]).toContain('LIKE');
      expect(sendQuery[0]).not.toContain('ILIKE');
      expect(sendQuery[1]).toEqual(['%pulsera%']);

      expect(imgQuery[0]).toContain('SELECT * FROM product_images');
      const sentData = res.json.mock.calls[0][0];
      expect(sentData[0].name).toBe('Pulsera Rosa');
      expect(sentData[0].images).toHaveLength(1);
    });

    test('retorna 500 con error genérico en fallo de DB', async () => {
      const req = { query: { q: 'test' }, protocol: 'https', get: () => 'localhost' };
      const res = mockRes();
      query.mockRejectedValueOnce(new Error('DB connection failed'));

      await searchProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });

    test('trimtea el query antes de usarlo', async () => {
      const req = { query: { q: '  pulsera  ' }, protocol: 'https', get: () => 'localhost' };
      const res = mockRes();
      query.mockResolvedValueOnce({ rows: [] });

      await searchProducts(req, res);

      const [, params] = query.mock.calls[0];
      expect(params).toEqual(['%pulsera%']);
    });
  });
});
