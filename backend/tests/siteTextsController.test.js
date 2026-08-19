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
  deleteFromBlob: jest.fn(() => Promise.resolve(true)),
  getPublicUrl: jest.fn((url) => url),
  saveUploadedFile: jest.fn(() => 'uploaded-file.jpg')
}));

const { query } = require('../src/lib/db');
const { getSiteTexts, upsertSiteText, syncTextsToNeon } = require('../src/controllers/siteTextsController');

describe('siteTextsController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getSiteTexts', () => {
    test('retorna textos del sitio', async () => {
      const req = {};
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({
        rows: [
          { key: 'hero_title', value: 'Bienvenido', updated_at: '2024-01-01T00:00:00.000Z' },
          { key: 'hero_subtitle', value: 'Artesanías únicas', updated_at: '2024-01-02T00:00:00.000Z' }
        ]
      });

      await getSiteTexts(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          hero_title: 'Bienvenido',
          hero_subtitle: 'Artesanías únicas',
          __updatedAt: '2024-01-02T00:00:00.000Z'
        })
      );
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getSiteTexts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('upsertSiteText', () => {
    test('crea nuevo texto', async () => {
      const req = {
        body: { key: 'hero_title', value: 'Nuevo Título' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await upsertSiteText(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_texts'),
        ['hero_title', 'Nuevo Título']
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('actualiza texto existente', async () => {
      const req = {
        body: { key: 'hero_title', value: 'Actualizado' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await upsertSiteText(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (key) DO UPDATE'),
        expect.arrayContaining(['Actualizado'])
      );
    });

    test('usa key de params si no está en body', async () => {
      const req = {
        params: { key: 'hero_title' },
        body: { value: 'Desde params' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await upsertSiteText(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_texts'),
        ['hero_title', 'Desde params']
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 400 si falta key o value', async () => {
      const req = { body: { key: 'hero_title' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await upsertSiteText(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'key y value son requeridos' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { key: 'hero_title', value: 'Test' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await upsertSiteText(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('syncTextsToNeon', () => {
    test('sincroniza textos correctamente', async () => {
      const req = {
        body: { hero_title: 'Nuevo', hero_subtitle: 'Subtítulo' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ max_updated: '2024-01-01T00:00:00.000Z' }] });

      await syncTextsToNeon(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          results: { saved: 2, errors: 0 },
          updatedAt: '2024-01-01T00:00:00.000Z'
        })
      );
    });

    test('maneja errores individuales en sync', async () => {
      const req = {
        body: { hero_title: 'Test' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockRejectedValueOnce(new Error('DB error'));

      await syncTextsToNeon(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          results: { saved: 0, errors: 1 }
        })
      );
    });

    test('elimina imágenes antiguas al sincronizar', async () => {
      const req = {
        body: { hero_image_url: '' }
      };
      const res = { json: jest.fn() };

      const { deleteFromBlob } = require('../src/lib/upload');
      deleteFromBlob.mockResolvedValueOnce(true);

      query.mockResolvedValueOnce({
        rows: [
          { key: 'hero_image_url', value: 'http://old-image.com/img.jpg' }
        ]
      });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ max_updated: null }] });

      await syncTextsToNeon(req, res);

      expect(deleteFromBlob).toHaveBeenCalledWith('http://old-image.com/img.jpg');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_texts'),
        ['hero_image_url', '']
      );
    });

    test('emite syncBus después de sincronizar', async () => {
      const req = {
        body: { hero_title: 'Test' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ max_updated: null }] });

      await syncTextsToNeon(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('site_texts_updated', { updatedAt: null });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { hero_title: 'Test' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));
      query.mockRejectedValueOnce(new Error('DB error'));

      await syncTextsToNeon(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          results: { saved: 0, errors: 1 }
        })
      );
    });
  });
});
