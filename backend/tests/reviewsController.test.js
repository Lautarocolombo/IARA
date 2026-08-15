jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/validators', () => ({
  reviewSchema: {
    parse: jest.fn((data) => data)
  }
}));

jest.mock('../src/lib/upload', () => ({
  saveUploadedFile: jest.fn()
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

const { query } = require('../src/lib/db');
const { reviewSchema } = require('../src/lib/validators');
const { getProductReviews, createReview } = require('../src/controllers/reviewsController');

describe('reviewsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProductReviews', () => {
    test('retorna reseñas de un producto', async () => {
      const req = { params: { productId: 1 } };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, product_id: 1, rating: 5, comment: 'Excelente', name: 'Juan', avatar: '', created_at: '2024-01-01' }
        ]
      });

      await getProductReviews(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith([
        { id: 1, product_id: 1, rating: 5, comment: 'Excelente', name: 'Juan', avatar: '', created_at: '2024-01-01' }
      ]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { productId: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getProductReviews(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('createReview', () => {
    test('crea reseña exitosamente', async () => {
      const req = {
        params: { productId: 1 },
        body: { rating: 5, comment: 'Excelente producto', name: 'Juan' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      reviewSchema.parse.mockReturnValueOnce({ rating: 5, comment: 'Excelente producto', name: 'Juan' });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, rating: 5, comment: 'Excelente producto', name: 'Juan', avatar: '', tenant_id: 'default' }]
      });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          rating: 5,
          comment: 'Excelente producto'
        })
      );
    });

    test('emite syncBus después de crear', async () => {
      const req = {
        params: { productId: 1 },
        body: { rating: 5, comment: 'Bueno' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      reviewSchema.parse.mockReturnValueOnce({ rating: 5, comment: 'Bueno' });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, rating: 5, comment: 'Bueno', name: '', avatar: '', tenant_id: 'default' }]
      });

      await createReview(req, res);

      const { syncBus } = require('../src/routes/sync');
      expect(syncBus.emit).toHaveBeenCalledWith('reviews_updated', { productId: 1 });
    });

    test('procesa avatar si hay archivo', async () => {
      const req = {
        params: { productId: 1 },
        body: { rating: 5, comment: 'Bueno' },
        file: { originalname: 'avatar.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      reviewSchema.parse.mockReturnValueOnce({ rating: 5, comment: 'Bueno' });
      const { saveUploadedFile } = require('../src/lib/upload');
      saveUploadedFile.mockResolvedValueOnce('/uploads/avatar.jpg');

      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, rating: 5, comment: 'Bueno', name: '', avatar: '/uploads/avatar.jpg', tenant_id: 'default' }]
      });

      await createReview(req, res);

      expect(saveUploadedFile).toHaveBeenCalledWith(req.file);
      expect(query.mock.calls[0][1]).toContain('/uploads/avatar.jpg');
    });

    test('maneja error de validación zod', async () => {
      const req = {
        params: { productId: 1 },
        body: { rating: 10, comment: 'Invalido' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      const zodError = new Error('Validation failed');
      zodError.name = 'ZodError';
      zodError.issues = [{ message: 'Rating inválido' }];
      reviewSchema.parse.mockImplementation(() => { throw zodError; });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Rating inválido' });
    });

    test('continúa si falla guardado de avatar', async () => {
      const req = {
        params: { productId: 1 },
        body: { rating: 5, comment: 'Bueno' },
        file: { originalname: 'avatar.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      reviewSchema.parse.mockReturnValueOnce({ rating: 5, comment: 'Bueno' });
      const { saveUploadedFile } = require('../src/lib/upload');
      saveUploadedFile.mockRejectedValueOnce(new Error('Upload failed'));

      query.mockResolvedValueOnce({
        rows: [{ id: 1, product_id: 1, rating: 5, comment: 'Bueno', name: '', avatar: '', tenant_id: 'default' }]
      });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { productId: 1 },
        body: { rating: 5, comment: 'Bueno' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      reviewSchema.parse.mockReturnValueOnce({ rating: 5, comment: 'Bueno' });
      query.mockRejectedValueOnce(new Error('DB error'));

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
