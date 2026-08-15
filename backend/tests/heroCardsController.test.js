jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  getPublicUrl: jest.fn((url, base) => url || ''),
  saveUploadedFile: jest.fn(),
  deleteImageAsset: jest.fn()
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const { getHeroCards, upsertHeroCard, deleteHeroCard } = require('../src/controllers/heroCardsController');

describe('heroCardsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BACKEND_URL;
    delete process.env.SITE_URL;
  });

  describe('getHeroCards', () => {
    test('retorna hero cards mapeadas', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn(() => 'localhost:10000')
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Test', precio: '100', imagen: '/uploads/test.jpg', emoji: '📿', orden: 0, activo: true, titulo: 'T', subtitulo: 'S', descripcion: 'D', cta_texto: 'CTA', cta_url: '/url', tipo: 'hero' }
        ]
      });

      const { getPublicUrl } = require('../src/lib/upload');
      getPublicUrl.mockReturnValueOnce('http://localhost:10000/uploads/test.jpg');

      await getHeroCards(req, res);

      expect(res.json).toHaveBeenCalledWith([
        {
          id: 1,
          slot: 1,
          nombre: 'Test',
          precio: '100',
          imagen: 'http://localhost:10000/uploads/test.jpg',
          emoji: '📿',
          orden: 0,
          activo: true,
          titulo: 'T',
          subtitulo: 'S',
          descripcion: 'D',
          cta_texto: 'CTA',
          cta_url: '/url',
          tipo: 'hero'
        }
      ]);
    });

    test('usa BACKEND_URL si está configurado', async () => {
      process.env.BACKEND_URL = 'https://api.example.com';
      const req = {
        protocol: 'http',
        get: jest.fn(() => 'localhost:10000')
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Test', precio: '', imagen: '', emoji: '📿', orden: 0, activo: true, titulo: '', subtitulo: '', descripcion: '', cta_texto: '', cta_url: '', tipo: 'hero' }
        ]
      });

      await getHeroCards(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getHeroCards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('upsertHeroCard', () => {
    test('crea nueva hero card cuando no existe', async () => {
      const req = {
        params: {},
        body: { slot: 1, nombre: 'Nueva Card', precio: '200' },
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Nueva Card', precio: '200', imagen: '', emoji: '📿', orden: 0, activo: true, titulo: '', subtitulo: '', descripcion: '', cta_texto: '', cta_url: '', tipo: 'hero' }
        ]
      });

      await upsertHeroCard(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hero_cards'),
        expect.arrayContaining(['Nueva Card', '200', '', '📿', 0, true, '', '', '', '', '', 1])
      );
      expect(res.json).toHaveBeenCalled();
    });

    test('actualiza hero card existente por id', async () => {
      const req = {
        params: { id: 1 },
        body: { nombre: 'Actualizada' },
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Actualizada', precio: '', imagen: '', emoji: '📿', orden: 0, activo: true, titulo: '', subtitulo: '', descripcion: '', cta_texto: '', cta_url: '', tipo: 'hero' }
        ]
      });

      await upsertHeroCard(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hero_cards SET'),
        expect.arrayContaining(['Actualizada'])
      );
    });

    test('upserta por slot cuando no hay id', async () => {
      const req = {
        params: {},
        body: { slot: 1, nombre: 'Slot Card' },
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, slot: 1 }] });
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Slot Card', precio: '', imagen: '', emoji: '📿', orden: 0, activo: true, titulo: '', subtitulo: '', descripcion: '', cta_texto: '', cta_url: '', tipo: 'hero' }
        ]
      });

      await upsertHeroCard(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hero_cards SET'),
        expect.arrayContaining(['Slot Card'])
      );
    });

    test('procesa archivo de imagen', async () => {
      const req = {
        params: { id: 1 },
        body: { nombre: 'Con Imagen' },
        file: { originalname: 'card.jpg' },
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      const { saveUploadedFile } = require('../src/lib/upload');
      saveUploadedFile.mockResolvedValueOnce('/uploads/card.jpg');

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Con Imagen', precio: '', imagen: '/uploads/card.jpg', emoji: '📿', orden: 0, activo: true, titulo: '', subtitulo: '', descripcion: '', cta_texto: '', cta_url: '', tipo: 'hero' }
        ]
      });

      await upsertHeroCard(req, res);

      expect(saveUploadedFile).toHaveBeenCalledWith(req.file);
    });

    test('emite syncBus después de guardar', async () => {
      const req = {
        params: { id: 1 },
        body: { nombre: 'Test' },
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, slot: 1, nombre: 'Test', precio: '', imagen: '', emoji: '📿', orden: 0, activo: true, titulo: '', subtitulo: '', descripcion: '', cta_texto: '', cta_url: '', tipo: 'hero' }
        ]
      });

      await upsertHeroCard(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { id: 1 },
        body: { nombre: 'Test' },
        protocol: 'http',
        get: jest.fn(() => 'localhost')
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await upsertHeroCard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteHeroCard', () => {
    test('elimina hero card exitosamente', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteHeroCard(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si card no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteHeroCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Card no encontrada' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteHeroCard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
