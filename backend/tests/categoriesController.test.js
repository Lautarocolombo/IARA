jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  saveUploadedFile: jest.fn().mockResolvedValue('/uploads/category-image.webp')
}));

const { query } = require('../src/lib/db');
const {
  getCategories,
  getPublicCategories,
  createCategory,
  updateCategory,
  updateCategoryOrder,
  deleteCategory
} = require('../src/controllers/categoriesController');

describe('categoriesController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getCategories', () => {
    test('retorna todas las categorías', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Pulseras', product_count: 5 }] });

      await getCategories(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPublicCategories', () => {
    test('retorna categorías públicas activas', async () => {
      const req = { query: {} };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, active: true, name: 'Pulseras' }] });

      await getPublicCategories(req, res);

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

      await getPublicCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createCategory', () => {
    test('crea categoría exitosamente', async () => {
      const req = {
        body: { name: 'Nueva Categoria', slug: 'nueva-categoria' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Nueva Categoria' }] });

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    test('retorna 400 si falta nombre o slug', async () => {
      const req = {
        body: { name: '' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('retorna 409 si el slug ya existe', async () => {
      const req = {
        body: { name: 'Categoria', slug: 'categoria' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      const error = new Error('duplicate key');
      error.code = '23505';
      query.mockRejectedValueOnce(error);

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('maneja error de base de datos', async () => {
      const req = {
        body: { name: 'Categoria', slug: 'categoria' },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateCategory', () => {
    test('actualiza categoría exitosamente', async () => {
      const req = {
        params: { id: '1' },
        body: { name: 'Categoria Actualizada' },
        file: null
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Categoria Actualizada' }] });

      await updateCategory(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Categoria Actualizada' }));
    });

    test('retorna 404 si la categoría no existe', async () => {
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

      await updateCategory(req, res);

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

      await updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateCategoryOrder', () => {
    test('actualiza orden de categorías', async () => {
      const req = {
        body: { orden: [{ id: 1, orden: 2 }, { id: 2, orden: 1 }] }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateCategoryOrder(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 400 si no es array', async () => {
      const req = { body: { orden: 'invalid' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateCategoryOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteCategory', () => {
    test('elimina categoría sin productos ni hijos', async () => {
      const req = { params: { id: '1' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ slug: 'pulseras', name: 'Pulseras' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteCategory(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, reassigned: 0, productCount: 0 });
    });

    test('retorna 404 si la categoría no existe', async () => {
      const req = { params: { id: '999' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si tiene subcategorías', async () => {
      const req = { params: { id: '1' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ slug: 'pulseras', name: 'Pulseras' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
