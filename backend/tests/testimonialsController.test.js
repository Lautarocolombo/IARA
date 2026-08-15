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
  saveUploadedFile: jest.fn()
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const { getPublicTestimonials, getAdminTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } = require('../src/controllers/testimonialsController');

describe('testimonialsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPublicTestimonials', () => {
    test('retorna testimonios públicos activos', async () => {
      const req = {};
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '', avatar: '', active: true, orden: 0, created_at: '2024-01-01' }
        ]
      });

      await getPublicTestimonials(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith([
        { id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '', avatar: '', active: true, orden: 0, created_at: '2024-01-01' }
      ]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPublicTestimonials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getAdminTestimonials', () => {
    test('retorna todos los testimonios', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Juan', comment: 'Excelente', active: true, orden: 0 }
        ]
      });

      await getAdminTestimonials(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { id: 1, name: 'Juan', comment: 'Excelente', active: true, orden: 0 }
      ]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getAdminTestimonials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('createTestimonial', () => {
    test('crea testimonio exitosamente', async () => {
      const req = {
        body: { name: 'Juan', comment: 'Excelente', rating: 5, active: true, orden: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '', avatar: '', active: true, orden: 1, tenant_id: 'default' }]
      });

      await createTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Juan' })
      );
    });

    test('retorna 400 si faltan name o comment', async () => {
      const req = { body: { name: 'Juan' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Nombre y comentario son requeridos' });
    });

    test('procesa archivo de imagen', async () => {
      const req = {
        body: { name: 'Juan', comment: 'Excelente' },
        file: { originalname: 'avatar.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      const { saveUploadedFile } = require('../src/lib/upload');
      saveUploadedFile.mockResolvedValueOnce('/uploads/avatar.jpg');

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '/uploads/avatar.jpg', avatar: '/uploads/avatar.jpg', active: true, orden: 0, tenant_id: 'default' }]
      });

      await createTestimonial(req, res);

      expect(saveUploadedFile).toHaveBeenCalledWith(req.file);
      expect(query.mock.calls[0][1]).toContain('/uploads/avatar.jpg');
    });

    test('emite syncBus después de crear', async () => {
      const req = {
        body: { name: 'Juan', comment: 'Excelente' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '', avatar: '', active: true, orden: 0, tenant_id: 'default' }]
      });

      await createTestimonial(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('testimonials_updated', { id: 1 });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { name: 'Juan', comment: 'Excelente' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateTestimonial', () => {
    test('actualiza testimonio exitosamente', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Juan Actualizado', rating: 4 }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Juan Actualizado', comment: 'Excelente', rating: 4, image: '', active: true, orden: 0, tenant_id: 'default' }]
      });

      await updateTestimonial(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Juan Actualizado', rating: 4 })
      );
    });

    test('actualiza imagen y avatar cuando se envía image', async () => {
      const req = {
        params: { id: 1 },
        body: { image: '/uploads/new.jpg' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '/uploads/new.jpg', avatar: '/uploads/new.jpg', active: true, orden: 0, tenant_id: 'default' }]
      });

      await updateTestimonial(req, res);

      expect(query.mock.calls[0][0]).toContain('image = $1');
      expect(query.mock.calls[0][0]).toContain('avatar = $1');
    });

    test('retorna 400 sin datos para actualizar', async () => {
      const req = {
        params: { id: 1 },
        body: { id: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Sin datos para actualizar' });
    });

    test('retorna 404 si testimonio no existe', async () => {
      const req = {
        params: { id: 999 },
        body: { name: 'Juan' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Testimonio no encontrado' });
    });

    test('emite syncBus después de actualizar', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Juan' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Juan', comment: 'Excelente', rating: 5, image: '', active: true, orden: 0, tenant_id: 'default' }]
      });

      await updateTestimonial(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('testimonials_updated', { id: 1 });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Juan' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteTestimonial', () => {
    test('elimina testimonio exitosamente', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteTestimonial(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si testimonio no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Testimonio no encontrado' });
    });

    test('emite syncBus después de eliminar', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteTestimonial(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('testimonials_updated', { id: 1 });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
