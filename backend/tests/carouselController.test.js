/* eslint-env jest */
const fs = require('fs');
const path = require('path');

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
  processFile: jest.fn().mockResolvedValue({ url: '/uploads/test.webp', public_id: 'test', blobName: 'test' })
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const {
  getCarouselSlots,
  getCarouselSlotsPublic,
  updateCarouselSlot,
  updateCarouselSlotMeta,
  deleteCarouselSlot
} = require('../src/controllers/carouselController');

describe('carouselController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getCarouselSlots', () => {
    test('retorna slots del carrusel', async () => {
      const req = { tenantId: 'default', headers: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, url: '/uploads/c1.webp' }] });

      await getCarouselSlots(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ slots: expect.any(Object) }));
    });

    test('maneja error de base de datos', async () => {
      const req = { tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getCarouselSlots(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCarouselSlotsPublic', () => {
    test('retorna slots públicos', async () => {
      const req = { tenantId: 'default', headers: {} };
      const res = { setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ slot: 1, url: '/uploads/c1.webp' }] });

      await getCarouselSlotsPublic(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      expect(res.json).toHaveBeenCalled();
    });

    test('maneja error de base de datos', async () => {
      const req = { tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getCarouselSlotsPublic(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateCarouselSlot', () => {
    test('retorna 400 si slot inválido', async () => {
      const req = { params: { slot: '99' }, file: {}, body: {}, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('retorna 400 si no se recibió imagen', async () => {
      const req = { params: { slot: '1' }, body: {}, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('actualiza slot con imagen', async () => {
      const req = {
        params: { slot: '1' },
        file: { originalname: 'test.jpg' },
        body: { alt_text: 'Alt', link_url: '', caption: '', about_group: '0' },
        tenantId: 'default',
        headers: {}
      };
      const res = { status: jest.fn(() => res), setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, url: '/uploads/c1.webp', alt_text: 'Alt' }] });

      await updateCarouselSlot(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('elimina imagen anterior al reemplazar', async () => {
      const req = {
        params: { slot: '1' },
        file: { originalname: 'test.jpg' },
        body: {},
        tenantId: 'default',
        headers: {}
      };
      const res = { status: jest.fn(() => res), setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, url: '/uploads/old.webp' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, url: '/uploads/new.webp' }] });

      await updateCarouselSlot(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('maneja error de base de datos', async () => {
      const req = {
        params: { slot: '1' },
        file: { originalname: 'test.jpg' },
        body: {},
        tenantId: 'default',
        headers: {}
      };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateCarouselSlotMeta', () => {
    test('retorna 400 si slot inválido', async () => {
      const req = { params: { slot: '0' }, body: {}, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      await updateCarouselSlotMeta(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('actualiza meta de slot existente', async () => {
      const req = {
        params: { slot: '1' },
        body: { alt_text: 'Nuevo Alt', link_url: 'https://x.com', caption: 'Cap', about_group: '1' },
        tenantId: 'default',
        headers: {}
      };
      const res = { status: jest.fn(() => res), setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, alt_text: 'Nuevo Alt' }] });

      await updateCarouselSlotMeta(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('inserta nuevo slot si no existe', async () => {
      const req = {
        params: { slot: '2' },
        body: { alt_text: 'Alt', link_url: '', caption: '', about_group: '0' },
        tenantId: 'default',
        headers: {}
      };
      const res = { status: jest.fn(() => res), setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 2, slot: 2 }] });

      await updateCarouselSlotMeta(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('maneja error de base de datos', async () => {
      const req = { params: { slot: '1' }, body: {}, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateCarouselSlotMeta(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteCarouselSlot', () => {
    test('retorna 400 si slot inválido', async () => {
      const req = { params: { slot: '0' }, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      await deleteCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('elimina slot existente', async () => {
      const req = { params: { slot: '1' }, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1, url: '/uploads/c1.webp' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteCarouselSlot(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('no hace nada si el slot no existe', async () => {
      const req = { params: { slot: '1' }, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), setHeader: jest.fn(), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteCarouselSlot(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('maneja error de base de datos', async () => {
      const req = { params: { slot: '1' }, tenantId: 'default', headers: {} };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteCarouselSlot(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});