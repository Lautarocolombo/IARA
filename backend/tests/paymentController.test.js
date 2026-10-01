jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/queues/webhookQueue', () => ({
  enqueueWebhook: jest.fn()
}));

const { query, transaction } = require('../src/lib/db');
const { confirmTransferPayment, getPaymentStatus, processWebhookSync } = require('../src/controllers/paymentController');

describe('paymentController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation((fn) => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
      };
      return fn(client);
    });
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

    test('genera reference automáticamente si no se proporciona', async () => {
      const req = {
        body: { orderId: 1, amount: 1000 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', total: 1000 }] });

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }));
    });

    test('retorna 400 si faltan orderId o amount', async () => {
      const req = { body: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'orderId y amount son requeridos' });
    });

    test('retorna 404 si pedido no existe', async () => {
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
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    test('retorna 400 si pedido está cancelado', async () => {
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

    test('retorna 400 si monto no coincide', async () => {
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

    test('hace fallback a procesamiento síncrono si la cola falla', async () => {
      const req = {
        body: { orderId: 1, amount: 1000, idempotency_key: 'idem-1' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', total: 1000 }] });

      const clientQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      transaction.mockImplementation((fn) => {
        const client = { query: clientQuery };
        return fn(client);
      });

      const { enqueueWebhook } = require('../src/queues/webhookQueue');
      enqueueWebhook.mockRejectedValueOnce(new Error('Queue error'));

      await confirmTransferPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(enqueueWebhook).toHaveBeenCalled();
    });
  });

  describe('getPaymentStatus', () => {
    test('retorna eventos de webhook', async () => {
      const req = {};
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ event_id: '1', status: 'processed' }] });

      await getPaymentStatus(req, res);

      expect(res.json).toHaveBeenCalledWith([{ event_id: '1', status: 'processed' }]);
    });
  });

  describe('processWebhookSync', () => {
    test('procesa webhook y actualiza estado', async () => {
      const clientQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });
      transaction.mockImplementation((fn) => {
        const client = { query: clientQuery };
        return fn(client);
      });

      const payload = { orderId: 1, amount: 1000, reference: 'ref-123' };

      await processWebhookSync(payload);

      expect(clientQuery).toHaveBeenCalled();
    });
  });
});
