jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  getPublicUrl: jest.fn((url) => url || ''),
  deleteImageAsset: jest.fn().mockResolvedValue(true),
  saveUploadedFile: jest.fn().mockResolvedValue('/uploads/hero-card.webp')
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const {
  getHeroCards,
  getPublicHeroCards,
  getHeroCardBySlot,
  upsertHeroCard,
  updateHeroSlot,
  deleteHeroSlotImage,
  deleteHeroCard,
  syncHeroCards
} = require('../src/controllers/heroCardsController');

describe('heroCardsController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getHeroCards', () => {
    test('retorna todas las hero cards', async () => {
      const req = { protocol: 'http', get: () => 'localhost' };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, nombre: 'Card 1' }] });

      await getHeroCards(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('maneja error de base de datos', async () => {
      const req = { protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getHeroCards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPublicHeroCards', () => {
    test('retorna hero cards públicas activas', async () => {
      const req = { protocol: 'http', get: () => 'localhost' };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, activo: true }] });

      await getPublicHeroCards(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalled();
    });

    test('maneja error de base de datos', async () => {
      const req = { protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPublicHeroCards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getHeroCardBySlot', () => {
    test('retorna card por slot', async () => {
      const req = { params: { slot: '1' }, protocol: 'http', get: () => 'localhost' };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1 }] });

      await getHeroCardBySlot(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    test('retorna 404 si no existe', async () => {
      const req = { params: { slot: '999' }, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await getHeroCardBySlot(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('upsertHeroCard', () => {
    test('crea card cuando no existe', async () => {
      const req = {
        params: {},
        body: { slot: 1, nombre: 'Nueva Card' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, nombre: 'Nueva Card' }] });

      await upsertHeroCard(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('actualiza card existente por ID', async () => {
      const req = {
        params: { id: '1' },
        body: { nombre: 'Card Actualizada' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Card Actualizada' }] });

      await upsertHeroCard(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('actualiza card existente por slot', async () => {
      const req = {
        params: {},
        body: { slot: 1, nombre: 'Card Actualizada' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Card Actualizada' }] });

      await upsertHeroCard(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('maneja error de base de datos', async () => {
      const req = {
        params: {},
        body: { slot: 1 },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await upsertHeroCard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateHeroSlot', () => {
    test('crea card si no existe', async () => {
      const req = {
        params: { slot: '1' },
        body: { titulo: 'Nuevo Titulo' },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, titulo: 'Nuevo Titulo' }] });

      await updateHeroSlot(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Nuevo Titulo' }));
    });

    test('actualiza card existente', async () => {
      const req = {
        params: { slot: '1' },
        body: { titulo: 'Titulo Actualizado', activo: true },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, titulo: 'Titulo Actualizado', activo: true }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, titulo: 'Titulo Actualizado' }] });

      await updateHeroSlot(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Titulo Actualizado' }));
    });
  });

  describe('deleteHeroSlotImage', () => {
    test('elimina imagen del slot', async () => {
      const req = { params: { slot: '1' }, protocol: 'http', get: () => 'localhost' };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, imagen: '/uploads/hero.webp' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteHeroSlotImage(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Imagen eliminada' });
    });

    test('retorna 404 si el slot no existe', async () => {
      const req = { params: { slot: '999' }, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteHeroSlotImage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteHeroCard', () => {
    test('elimina card exitosamente', async () => {
      const req = { params: { id: '1' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteHeroCard(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si la card no existe', async () => {
      const req = { params: { id: '999' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteHeroCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('syncHeroCards', () => {
    test('sincroniza hero cards', async () => {
      const req = {
        body: { cards: [{ nombre: 'Card 1', slot: 1 }] },
        protocol: 'http',
        get: () => 'localhost'
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await syncHeroCards(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('maneja error de base de datos', async () => {
      const req = { body: {}, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await syncHeroCards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
