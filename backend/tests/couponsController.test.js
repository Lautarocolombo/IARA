jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon } = require('../src/controllers/couponsController');

describe('couponsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCoupons', () => {
    test('retorna lista de cupones', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, code: 'DESC10', type: 'percent', value: 10, min_amount: 0, max_uses: 100, expires_at: null, active: true }
        ]
      });

      await getCoupons(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { id: 1, code: 'DESC10', type: 'percent', value: 10, min_amount: 0, max_uses: 100, expires_at: null, active: true }
      ]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getCoupons(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('createCoupon', () => {
    test('crea cupón exitosamente', async () => {
      const req = {
        body: { code: 'DESC10', type: 'percent', value: 10, min_amount: 1000, max_uses: 50, expires_at: '2024-12-31', active: true }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, code: 'DESC10', type: 'percent', value: 10, min_amount: 1000, max_uses: 50, expires_at: '2024-12-31', active: true }]
      });

      await createCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, code: 'DESC10' })
      );
    });

    test('retorna 400 si faltan campos requeridos', async () => {
      const req = { body: { code: 'DESC10' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Código, tipo y valor son requeridos' });
    });

    test('convierte valores numéricos correctamente', async () => {
      const req = {
        body: { code: 'DESC10', type: 'fixed', value: '500', min_amount: '1000', max_uses: '10' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, code: 'DESC10', type: 'fixed', value: 500, min_amount: 1000, max_uses: 10, expires_at: null, active: true }]
      });

      await createCoupon(req, res);

      expect(query.mock.calls[0][1]).toEqual(['DESC10', 'fixed', 500, 1000, 10, null, true]);
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { code: 'DESC10', type: 'percent', value: 10 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateCoupon', () => {
    test('actualiza cupón exitosamente', async () => {
      const req = {
        params: { id: 1 },
        body: { code: 'DESC20', type: 'fixed', value: 200 }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, code: 'DESC20', type: 'fixed', value: 200, min_amount: 0, max_uses: 0, expires_at: null, active: true }]
      });

      await updateCoupon(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, code: 'DESC20' })
      );
    });

    test('retorna 404 si cupón no existe', async () => {
      const req = {
        params: { id: 999 },
        body: { code: 'DESC20' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cupón no encontrado' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { id: 1 },
        body: { code: 'DESC20' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteCoupon', () => {
    test('elimina cupón exitosamente', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteCoupon(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 404 si cupón no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cupón no encontrado' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('validateCoupon', () => {
    test('valida cupón percent exitosamente', async () => {
      const req = {
        body: { code: 'DESC10', amount: 5000 }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { code: 'DESC10', type: 'percent', value: 10, min_amount: 1000, max_uses: 100, used_count: 5, expires_at: null, active: true }
        ]
      });

      await validateCoupon(req, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        code: 'DESC10',
        type: 'percent',
        value: 10,
        discount: 500,
        finalAmount: 4500
      });
    });

    test('valida cupón fixed exitosamente', async () => {
      const req = {
        body: { code: 'DESC500', amount: 5000 }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { code: 'DESC500', type: 'fixed', value: 500, min_amount: 1000, max_uses: 100, used_count: 0, expires_at: null, active: true }
        ]
      });

      await validateCoupon(req, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        code: 'DESC500',
        type: 'fixed',
        value: 500,
        discount: 500,
        finalAmount: 4500
      });
    });

    test('retorna 400 si faltan code o amount', async () => {
      const req = { body: { code: 'DESC10' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await validateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Código y monto son requeridos' });
    });

    test('retorna 404 si cupón no existe', async () => {
      const req = {
        body: { code: 'NOPE', amount: 5000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await validateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cupón no encontrado o inactivo' });
    });

    test('retorna 400 si cupón expirado', async () => {
      const req = {
        body: { code: 'OLD', amount: 5000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { code: 'OLD', type: 'percent', value: 10, min_amount: 0, max_uses: 100, used_count: 0, expires_at: '2020-01-01', active: true }
        ]
      });

      await validateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cupón expirado' });
    });

    test('retorna 400 si cupón agotado', async () => {
      const req = {
        body: { code: 'FULL', amount: 5000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { code: 'FULL', type: 'percent', value: 10, min_amount: 0, max_uses: 10, used_count: 10, expires_at: null, active: true }
        ]
      });

      await validateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cupón agotado' });
    });

    test('retorna 400 si monto mínimo no alcanzado', async () => {
      const req = {
        body: { code: 'DESC10', amount: 500 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          { code: 'DESC10', type: 'percent', value: 10, min_amount: 1000, max_uses: 100, used_count: 0, expires_at: null, active: true }
        ]
      });

      await validateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Monto mínimo no alcanzado para este cupón' });
    });

    test('limita descuento al monto del pedido', async () => {
      const req = {
        body: { code: 'DESC99', amount: 1000 }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [
          { code: 'DESC99', type: 'percent', value: 99, min_amount: 0, max_uses: 100, used_count: 0, expires_at: null, active: true }
        ]
      });

      await validateCoupon(req, res);

      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        code: 'DESC99',
        type: 'percent',
        value: 99,
        discount: 990,
        finalAmount: 10
      });
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        body: { code: 'DESC10', amount: 5000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await validateCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
