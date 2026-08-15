jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  saveUploadedFile: jest.fn().mockResolvedValue('/uploads/testimonial-image.webp')
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const {
  getPublicTestimonials,
  getAdminTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialActive,
  updateTestimonialOrder
} = require('../src/controllers/testimonialsController');

describe('testimonialsController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getPublicTestimonials', () => {
    test('retorna testimonios públicos activos', async () => {
      const req = { query: {} };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, active: true, name: 'Juan' }] });

      await getPublicTestimonials(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPublicTestimonials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAdminTestimonials', () => {
    test('retorna todos los testimonios', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Juan' }] });

      await getAdminTestimonials(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getAdminTestimonials(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createTestimonial', () => {
    test('crea testimonio exitosamente', async () => {
      const req = {
        body: { name: 'Juan', comment: 'Excelente', rating: 5 },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Juan' }] });

      await createTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    test('retorna 400 si falta nombre o comentario', async () => {
      const req = {
        body: { name: '' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('maneja error de base de datos', async () => {
      const req = {
        body: { name: 'Juan', comment: 'Test' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateTestimonial', () => {
    test('actualiza testimonio exitosamente', async () => {
      const req = {
        params: { id: '1' },
        body: { name: 'Juan Actualizado', rating: 4 },
        file: null
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Juan Actualizado' }] });

      await updateTestimonial(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Juan Actualizado' }));
    });

    test('retorna 404 si el testimonio no existe', async () => {
      const req = {
        params: { id: '999' },
        body: { name: 'Nuevo Nombre' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si no hay datos para actualizar', async () => {
      const req = {
        params: { id: '1' },
        body: {},
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('toggleTestimonialActive', () => {
    test('cambia estado del testimonio', async () => {
      const req = { params: { id: '1' }, body: { active: false } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, active: false }] });

      await toggleTestimonialActive(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, active: false }));
    });

    test('retorna 404 si el testimonio no existe', async () => {
      const req = { params: { id: '999' }, body: { active: true } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await toggleTestimonialActive(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateTestimonialOrder', () => {
    test('actualiza orden de testimonios', async () => {
      const req = {
        body: { orden: [{ id: 1, orden: 2 }, { id: 2, orden: 1 }] }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateTestimonialOrder(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 400 si no es array', async () => {
      const req = { body: { orden: 'invalid' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateTestimonialOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteTestimonial', () => {
    test('elimina testimonio exitosamente', async () => {
      const req = { params: { id: '1' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteTestimonial(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si el testimonio no existe', async () => {
      const req = { params: { id: '999' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteTestimonial(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
