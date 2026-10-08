jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  deleteImageAsset: jest.fn(),
  processFile: jest.fn(),
  getPublicUrl: jest.fn(),
  isBlobConfigured: jest.fn(),
  isBlobUrl: jest.fn()
}));

const { query } = require('../src/lib/db');
const logger = require('../src/lib/logger');
const {
  deleteImageAsset,
  processFile,
  getPublicUrl
} = require('../src/lib/upload');
const {
  clearImageField,
  updateImageField,
  deleteOldAndSetNew,
  handleImageUpload,
  handleMultipleImageUpload,
  getTenantId
} = require('../src/lib/imageService');

describe('imageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('clearImageField', () => {
    test('clears image field and returns true on success', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await clearImageField('products', 'id', 123, 'image', 'default');

      expect(query).toHaveBeenCalledWith(
        'UPDATE products SET image = \'\', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
        [123, 'default']
      );
      expect(result).toBe(true);
    });

    test('returns false on DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      const result = await clearImageField('products', 'id', 123, 'image', 'default');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'DB error', table: 'products', idColumn: 'id', id: 123 }),
        'Error limpiando campo de imagen'
      );
    });
  });

  describe('updateImageField', () => {
    test('updates image field and returns true on success', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await updateImageField('products', 'id', 123, 'image', 'https://example.com/image.jpg', 'default');

      expect(query).toHaveBeenCalledWith(
        'UPDATE products SET image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        ['https://example.com/image.jpg', 123, 'default']
      );
      expect(result).toBe(true);
    });

    test('returns false on DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      const result = await updateImageField('products', 'id', 123, 'image', 'url', 'default');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'DB error', table: 'products', idColumn: 'id', id: 123 }),
        'Error actualizando campo de imagen'
      );
    });
  });

  describe('deleteOldAndSetNew', () => {
    test('returns false when record not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await deleteOldAndSetNew('products', 'id', 999, ['image'], 'new-url', 'default');

      expect(result).toBe(false);
    });

    test('deletes old images and sets new URL for single column', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ image: 'https://old.com/img1.jpg' }] }) // existing record
        .mockResolvedValueOnce({ rowCount: 1 }); // update

      deleteImageAsset.mockResolvedValueOnce(undefined);
      getPublicUrl.mockReturnValue('https://new.com/img.jpg');

      const result = await deleteOldAndSetNew('products', 'id', 123, ['image'], 'https://new.com/img.jpg', 'default');

      expect(deleteImageAsset).toHaveBeenCalledWith({
        url: 'https://old.com/img1.jpg',
        filename: 'img1.jpg'
      });
      expect(query).toHaveBeenCalledWith(
        'UPDATE products SET image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        ['https://new.com/img.jpg', 123, 'default']
      );
      expect(result).toBe(true);
    });

    test('handles multiple image columns', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ image: 'https://old.com/main.jpg', image2: 'https://old.com/alt.jpg' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      deleteImageAsset.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

      const result = await deleteOldAndSetNew('products', 'id', 123, ['image', 'image2'], 'https://new.com/img.jpg', 'default');

      expect(deleteImageAsset).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('image = $1, image2 = $2'),
        expect.arrayContaining(['https://new.com/img.jpg', 'https://new.com/img.jpg', 123, 'default'])
      );
      expect(result).toBe(true);
    });

    test('skips delete for empty column values', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ image: 'https://old.com/img.jpg', image2: '' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      deleteImageAsset.mockResolvedValueOnce(undefined);

      await deleteOldAndSetNew('products', 'id', 123, ['image', 'image2'], 'new-url', 'default');

      expect(deleteImageAsset).toHaveBeenCalledTimes(1);
    });

    test('returns false on DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      const result = await deleteOldAndSetNew('products', 'id', 123, ['image'], 'url', 'default');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'DB error', table: 'products', idColumn: 'id', id: 123 }),
        'Error reemplazando imagen'
      );
    });
  });

  describe('handleImageUpload', () => {
    test('returns null when no file provided', async () => {
      const result = await handleImageUpload(null, 'https://base.com');
      expect(result).toBeNull();
    });

    test('processes file and returns public URL', async () => {
      processFile.mockResolvedValueOnce({ url: 'processed-url' });
      getPublicUrl.mockReturnValue('https://public.com/image.jpg');

      const result = await handleImageUpload({ originalname: 'test.jpg' }, 'https://base.com');

      expect(processFile).toHaveBeenCalledWith({ originalname: 'test.jpg' }, 'https://base.com');
      expect(getPublicUrl).toHaveBeenCalledWith('processed-url', 'https://base.com');
      expect(result).toBe('https://public.com/image.jpg');
    });
  });

  describe('handleMultipleImageUpload', () => {
    test('returns empty array when no files', async () => {
      const result = await handleMultipleImageUpload(null, 'https://base.com');
      expect(result).toEqual([]);
    });

    test('returns empty array for empty array', async () => {
      const result = await handleMultipleImageUpload([], 'https://base.com');
      expect(result).toEqual([]);
    });

    test('processes multiple files and returns URLs', async () => {
      processFile.mockResolvedValueOnce({ url: 'url1' }).mockResolvedValueOnce({ url: 'url2' });
      getPublicUrl.mockReturnValueOnce('https://public.com/img1.jpg').mockReturnValueOnce('https://public.com/img2.jpg');

      const result = await handleMultipleImageUpload(
        [{ originalname: 'img1.jpg' }, { originalname: 'img2.jpg' }],
        'https://base.com'
      );

      expect(result).toEqual(['https://public.com/img1.jpg', 'https://public.com/img2.jpg']);
    });

    test('skips files that return null URL', async () => {
      processFile.mockResolvedValueOnce({ url: 'url1' }).mockResolvedValueOnce({ url: 'url2' });
      getPublicUrl.mockReturnValueOnce('https://public.com/img1.jpg').mockReturnValueOnce(null);

      const result = await handleMultipleImageUpload(
        [{ originalname: 'img1.jpg' }, { originalname: 'img2.jpg' }],
        'https://base.com'
      );

      expect(result).toEqual(['https://public.com/img1.jpg']);
    });
  });

  describe('getTenantId', () => {
    test('returns x-tenant-id header when present', () => {
      const req = { headers: { 'x-tenant-id': 'custom-tenant' }, user: { tenant_id: 'default' } };
      expect(getTenantId(req)).toBe('custom-tenant');
    });

    test('returns user.tenant_id when header not present', () => {
      const req = { headers: {}, user: { tenant_id: 'user-tenant' } };
      expect(getTenantId(req)).toBe('user-tenant');
    });

    test('returns "default" when neither header nor user present', () => {
      const req = { headers: {}, user: {} };
      expect(getTenantId(req)).toBe('default');
    });

    test('returns "default" when req is undefined throws', () => {
      expect(() => getTenantId(undefined)).toThrow();
    });

    test('returns "default" when req has no headers or user', () => {
      const req = {};
      expect(getTenantId(req)).toBe('default');
    });
  });

  describe('re-exports', () => {
    test('exports deleteImageAsset', () => {
      expect(typeof deleteImageAsset).toBe('function');
    });

    test('exports getPublicUrl', () => {
      expect(typeof getPublicUrl).toBe('function');
    });

    test('exports isBlobConfigured', () => {
      expect(typeof require('../src/lib/upload').isBlobConfigured).toBe('function');
    });

    test('exports isBlobUrl', () => {
      expect(typeof require('../src/lib/upload').isBlobUrl).toBe('function');
    });

    test('exports processFile', () => {
      expect(typeof require('../src/lib/upload').processFile).toBe('function');
    });
  });
});