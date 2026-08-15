jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const { confirmTransferPayment, getPaymentStatus, processWebhookSync, getPaymentReconciliation } = require('../src/controllers/paymentController');

describe('paymentController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('confirmTransferPayment', () => {
    test('confirma pago exitosamente', async () => {
      const req = {
        body: { orderId: 1, amount: 1000, reference: 'ref-123' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', total: 1000 }] });

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ accepted: true, orderId: 1, status: 'queued' });
    });

    test('retorna 400 si faltan orderId o amount', async () => {
      const req = {
        body: { orderId: 1 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'orderId y amount son requeridos' });
    });

    test('retorna 404 si el pedido no existe', async () => {
      const req = {
        body: { orderId: 999, amount: 1000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si el pedido está cancelado', async () => {
      const req = {
        body: { orderId: 1, amount: 1000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'cancelled', total: 1000 }] });

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se puede confirmar pago de un pedido cancelado' });
    });

    test('retorna 400 si el monto no coincide', async () => {
      const req = {
        body: { orderId: 1, amount: 500 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', total: 1000 }] });

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El monto no coincide con el total del pedido' });
    });
  });

  describe('getPaymentStatus', () => {
    test('retorna eventos de pago', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ event_id: 'evt-1', status: 'processed' }] });

      await getPaymentStatus(req, res);

      expect(res.json).toHaveBeenCalledWith([{ event_id: 'evt-1', status: 'processed' }]);
    });

    test('maneja error de base de datos', async () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getPaymentReconciliation', () => {
    test('retorna reconciliación de pagos', async () => {
      const req = {
        query: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ total_orders: '10', total_amount: '5000', confirmed_orders: '8', confirmed_amount: '4000', pending_orders: '2', pending_amount: '1000', cancelled_orders: '0', cancelled_amount: '0' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'confirmed', total: 500, created_at: '2024-01-01', payment_status: 'processed' }] });

      await getPaymentReconciliation(req, res);

      expect(res.json).toHaveBeenCalledWith({
        summary: expect.objectContaining({ total_orders: '10' }),
        details: expect.arrayContaining([expect.objectContaining({ id: 1 })])
      });
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPaymentReconciliation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
