jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

jest.mock('../src/lib/upload', () => ({
  getPublicUrl: jest.fn((url) => url),
  deleteImageAsset: jest.fn(() => Promise.resolve()),
  processFile: jest.fn(() => Promise.resolve({
    url: 'processed-image.jpg',
    public_id: 'public-id',
    blobName: 'blob-name'
  }))
}));

const { query } = require('../src/lib/db');
const { deleteImageAsset, processFile } = require('../src/lib/upload');
const { syncBus } = require('../src/routes/sync');
const {
  getCarouselSlots,
  updateCarouselSlot,
  deleteCarouselSlot
} = require('../src/controllers/carouselController');

function mockReq(overrides = {}) {
  return {
    protocol: 'https',
    get: jest.fn().mockReturnValue('artesaniagualeguay.com'),
    tenantId: 'default',
    ...overrides,
  };
}

function mockRes() {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('carouselController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BACKEND_URL;
    delete process.env.SITE_URL;
  });

  describe('getCarouselSlots', () => {
    test('retorna 5 slots con datos existentes y nulos para vacíos', async () => {
      const req = mockReq();
      const res = mockRes();

      query.mockResolvedValueOnce({
        rows: [
          { slot: 1, url: 'img1.jpg', alt_text: 'Alt 1', link_url: '/link1', tenant_id: 'default' },
          { slot: 3, url: 'img3.jpg', alt_text: 'Alt 3', link_url: '', tenant_id: 'default' },
        ]
      });

      await getCarouselSlots(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          slots: expect.objectContaining({
            1: expect.objectContaining({ url: 'img1.jpg' }),
            2: null,
            3: expect.objectContaining({ url: 'img3.jpg' }),
            4: null,
            5: null
          })
        })
      );
    });

    test('retorna todos los slots nulos cuando la tabla está vacía', async () => {
      const req = mockReq();
      const res = mockRes();

      query.mockResolvedValueOnce({ rows: [] });

      await getCarouselSlots(req, res);

      const result = res.json.mock.calls[0][0];
      Object.keys(result.slots).forEach(k => {
        expect(result.slots[k]).toBeNull();
      });
    });

    test('retorna 500 en error de DB', async () => {
      const req = mockReq();
      const res = mockRes();

      query.mockRejectedValueOnce(new Error('DB error'));

      await getCarouselSlots(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateCarouselSlot', () => {
    test('actualiza alt_text y link_url sin subir imagen', async () => {
      const req = mockReq({
        params: { slot: '1' },
        body: { alt_text: 'Nuevo alt', link_url: '/nuevo-link' },
      });
      const res = mockRes();

      query.mockResolvedValueOnce({
        rows: [{ slot: 1, url: 'img1.jpg', alt_text: '', link_url: '', tenant_id: 'default' }]
      });
      query.mockResolvedValueOnce({
        rows: [{ slot: 1, url: 'img1.jpg', alt_text: 'Nuevo alt', link_url: '/nuevo-link', tenant_id: 'default' }]
      });

      await updateCarouselSlot(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE carousel_images SET alt_text'),
        ['Nuevo alt', '/nuevo-link', 1, 'default']
      );
      expect(syncBus.emit).toHaveBeenCalledWith('carousel_updated', { slot: 1 });
      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 404 si el slot está vacío al intentar actualizar sin imagen', async () => {
      const req = mockReq({
        params: { slot: '2' },
        body: { alt_text: 'Test' },
      });
      const res = mockRes();

      query.mockResolvedValueOnce({ rows: [] });

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se recibió imagen' });
    });

    test('retorna 400 para slot inválido (no numérico)', async () => {
      const req = mockReq({
        params: { slot: 'abc' },
        body: { alt_text: 'Test' },
      });
      const res = mockRes();

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El slot debe ser un número entre 1 y 5' });
    });

    test('retorna 400 para slot fuera de rango', async () => {
      const req = mockReq({
        params: { slot: '6' },
        body: { alt_text: 'Test' },
      });
      const res = mockRes();

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El slot debe ser un número entre 1 y 5' });
    });

    test('sube nueva imagen y elimina la anterior', async () => {
      const req = mockReq({
        params: { slot: '1' },
        body: { alt_text: 'Nuevo', link_url: '/link' },
        file: { originalname: 'test.jpg', path: '/tmp/test.jpg', size: 1024, mimetype: 'image/jpeg' }
      });
      const res = mockRes();

      query.mockResolvedValueOnce({
        rows: [{ slot: 1, url: 'old-img.jpg', public_id: 'old-public-id', tenant_id: 'default' }]
      });
      query.mockResolvedValueOnce({
        rows: [{ slot: 1, url: 'processed-image.jpg', public_id: 'public-id', alt_text: 'Nuevo', link_url: '/link', tenant_id: 'default' }]
      });

      await updateCarouselSlot(req, res);

      expect(deleteImageAsset).toHaveBeenCalledWith(expect.objectContaining({ url: 'old-img.jpg' }));
      expect(processFile).toHaveBeenCalled();
      expect(syncBus.emit).toHaveBeenCalledWith('carousel_updated', { slot: 1 });
      expect(res.json).toHaveBeenCalled();
    });

    test('sube imagen sin slot previo existente', async () => {
      const req = mockReq({
        params: { slot: '1' },
        body: { alt_text: 'Nuevo', link_url: '/link' },
        file: { originalname: 'new.jpg', path: '/tmp/new.jpg', size: 2048, mimetype: 'image/jpeg' }
      });
      const res = mockRes();

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({
        rows: [{ slot: 1, url: 'processed-image.jpg', public_id: 'public-id', alt_text: 'Nuevo', link_url: '/link', tenant_id: 'default' }]
      });

      await updateCarouselSlot(req, res);

      expect(deleteImageAsset).not.toHaveBeenCalled();
      expect(processFile).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 500 en error de DB', async () => {
      const req = mockReq({
        params: { slot: '1' },
        body: { alt_text: 'Test' },
      });
      const res = mockRes();

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteCarouselSlot', () => {
    test('elimina slot existente y emite syncBus', async () => {
      const req = mockReq({
        params: { slot: '1' },
      });
      const res = mockRes();

      query.mockResolvedValueOnce({
        rows: [{ slot: 1, url: 'img1.jpg', public_id: 'pub-id', tenant_id: 'default' }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteCarouselSlot(req, res);

      expect(deleteImageAsset).toHaveBeenCalledWith(expect.objectContaining({ url: 'img1.jpg' }));
      expect(query).toHaveBeenCalledWith(
        'DELETE FROM carousel_images WHERE slot = $1 AND tenant_id = $2',
        [1, 'default']
      );
      expect(syncBus.emit).toHaveBeenCalledWith('carousel_updated', { slot: 1 });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna ok incluso si el slot está vacío', async () => {
      const req = mockReq({
        params: { slot: '1' },
      });
      const res = mockRes();

      query.mockResolvedValueOnce({ rows: [] });

      await deleteCarouselSlot(req, res);

      expect(deleteImageAsset).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 400 para slot inválido', async () => {
      const req = mockReq({
        params: { slot: '0' },
      });
      const res = mockRes();

      await deleteCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El slot debe ser un número entre 1 y 5' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = mockReq({
        params: { slot: '1' },
      });
      const res = mockRes();

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
