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

const { query } = require('../src/lib/db');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../src/controllers/categoriesController');

describe('categoriesController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    test('retorna lista de categorías', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Pulseras', slug: 'pulseras', description: '', active: true, orden: 0, emoji: '📿', image: '', parent_id: null, image_url: '', created_at: '2024-01-01', updated_at: '2024-01-01', product_count: 5 }
        ]
      });

      await getCategories(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { id: 1, name: 'Pulseras', slug: 'pulseras', description: '', active: true, orden: 0, emoji: '📿', image: '', parent_id: null, image_url: '', created_at: '2024-01-01', updated_at: '2024-01-01', product_count: 5 }
      ]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('createCategory', () => {
    test('crea categoría exitosamente', async () => {
      const req = {
        body: { name: 'Nueva', slug: 'nueva', description: 'Desc', active: true, orden: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Nueva', slug: 'nueva', description: 'Desc', active: true, orden: 1, emoji: '', image: '', parent_id: null, image_url: '', created_at: '2024-01-01', updated_at: '2024-01-01' }]
      });

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, name: 'Nueva', slug: 'nueva' })
      );
    });

    test('retorna 400 si faltan name o slug', async () => {
      const req = { body: { name: 'Nueva' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Nombre y slug son requeridos' });
    });

    test('retorna 409 en conflicto de unique', async () => {
      const req = {
        body: { name: 'Nueva', slug: 'nueva' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      const err = new Error('unique violation');
      err.code = '23505';
      query.mockRejectedValueOnce(err);

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Ya existe una categoría con ese nombre o slug' });
    });

    test('procesa archivo de imagen si existe', async () => {
      const req = {
        body: { name: 'Nueva', slug: 'nueva' },
        file: { originalname: 'test.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      const { saveUploadedFile } = require('../src/lib/upload');
      saveUploadedFile.mockResolvedValueOnce('/uploads/imagenes/test.jpg');

      query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'Nueva', slug: 'nueva', description: '', active: true, orden: 0, emoji: '', image: '', parent_id: null, image_url: '/uploads/imagenes/test.jpg', created_at: '2024-01-01', updated_at: '2024-01-01' }]
      });

      await createCategory(req, res);

      expect(saveUploadedFile).toHaveBeenCalledWith(req.file);
      expect(query.mock.calls[0][1]).toContain('/uploads/imagenes/test.jpg');
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { name: 'Nueva', slug: 'nueva' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateCategory', () => {
    test('actualiza categoría exitosamente', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Actualizada', active: false }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Actualizada', slug: 'pulseras', description: '', active: false, orden: 0, emoji: '📿', image: '', parent_id: null, image_url: '', created_at: '2024-01-01', updated_at: '2024-01-01' }]
      });

      await updateCategory(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Actualizada' })
      );
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

      await updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Sin datos para actualizar' });
    });

    test('filtra columnas no permitidas', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Actualizada', forbidden_col: 'hack' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Actualizada', slug: 'pulseras', description: '', active: true, orden: 0, emoji: '📿', image: '', parent_id: null, image_url: '', created_at: '2024-01-01', updated_at: '2024-01-01' }]
      });

      await updateCategory(req, res);

      expect(query.mock.calls[0][0]).not.toContain('forbidden_col');
    });

    test('retorna 404 si categoría no existe', async () => {
      const req = {
        params: { id: 999 },
        body: { name: 'Actualizada' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Actualizada' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteCategory', () => {
    test('elimina categoría exitosamente', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ slug: 'pulseras', name: 'Pulseras' }] });
      query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteCategory(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, reassigned: 0, productCount: 0 });
    });

    test('retorna 404 si categoría no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
    });

    test('previene eliminación con subcategorías', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ slug: 'pulseras', name: 'Pulseras' }] });
      query.mockResolvedValueOnce({ rows: [{ count: 2 }] });

      await deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Reasigná las subcategorías antes de eliminar esta categoría.' });
    });

    test('reasigna productos antes de eliminar', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ slug: 'pulseras', name: 'Pulseras' }] });
      query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ count: 3 }] });
      query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteCategory(req, res);

      expect(query).toHaveBeenCalledWith('UPDATE products SET category = \'\' WHERE category = $1', ['pulseras']);
      expect(res.json).toHaveBeenCalledWith({ ok: true, reassigned: 3, productCount: 3 });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
