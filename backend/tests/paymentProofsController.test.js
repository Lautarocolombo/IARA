jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/parser', () => ({
  safeJsonParse: jest.fn((v, def) => (v ? JSON.parse(v) : def))
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  createReadStream: jest.fn()
}));

jest.mock('path', () => ({
  dirname: jest.fn(() => '/tmp'),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn(),
  join: jest.fn()
}));

const { query } = require('../src/lib/db');
const {
  getAdminPaymentProofs,
  uploadPaymentProof,
  approvePaymentProof,
  rejectPaymentProof,
  getPaymentStats,
  getAdminActivityLog
} = require('../src/controllers/paymentProofsController');

describe('paymentProofsController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('getAdminPaymentProofs', () => {
    test('retorna comprobantes con paginación', async () => {
      const req = { query: { page: '1', limit: '10' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '2' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      await getAdminPaymentProofs(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        proofs: expect.any(Array),
        total: 2,
        page: 1
      }));
    });

    test('filtra por status y search', async () => {
      const req = { query: { status: 'pending', search: 'Juan' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await getAdminPaymentProofs(req, res);

      expect(query).toHaveBeenCalledWith(expect.stringContaining('status = $1'), expect.arrayContaining(['pending']));
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.arrayContaining(['%Juan%']));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getAdminPaymentProofs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('uploadPaymentProof', () => {
    test('sube comprobante exitosamente', async () => {
      const req = {
        params: { orderId: '1' },
        file: { path: '/uploads/comprobantes/proof.jpg' },
        body: { customerName: 'Juan' },
        headers: { 'x-tenant-id': 'default' },
        user: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100, customer: '{"name":"Juan"}' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await uploadPaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test('retorna 400 si el ID de pedido es inválido', async () => {
      const req = { params: { orderId: '0' }, file: {}, body: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await uploadPaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('retorna 404 si el pedido no existe', async () => {
      const req = {
        params: { orderId: '999' },
        file: { path: '/uploads/comprobantes/proof.jpg' },
        body: {},
        user: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await uploadPaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si falta el comprobante', async () => {
      const req = {
        params: { orderId: '1' },
        file: null,
        body: {},
        user: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100, customer: '{"name":"Juan"}' }] });

      await uploadPaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('approvePaymentProof', () => {
    test('aprueba comprobante y confirma pedido', async () => {
      const req = {
        params: { id: '1' },
        user: { user: 'admin' },
        headers: { 'x-tenant-id': 'default' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', order_id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await approvePaymentProof(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenCalledWith('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['confirmed', 1]);
    });

    test('retorna 404 si el comprobante no existe', async () => {
      const req = { params: { id: '999' }, user: {}, headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await approvePaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 400 si ya fue procesado', async () => {
      const req = { params: { id: '1' }, user: {}, headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'approved' }] });

      await approvePaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('rejectPaymentProof', () => {
    test('rechaza comprobante con motivo', async () => {
      const req = {
        params: { id: '1' },
        body: { reason: 'Monto incorrecto' },
        user: { user: 'admin' },
        headers: { 'x-tenant-id': 'default' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', order_id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await rejectPaymentProof(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenCalledWith('UPDATE payment_proofs SET status = $1, rejection_reason = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3', ['rejected', 'Monto incorrecto', 1]);
    });

    test('retorna 404 si el comprobante no existe', async () => {
      const req = { params: { id: '999' }, body: {}, user: {}, headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await rejectPaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPaymentStats', () => {
    test('retorna estadísticas de pagos', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ count: '5', total: '500' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '3', total: '300' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      query.mockResolvedValueOnce({ rows: [{ active: true }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getPaymentStats(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        approvedCount: 5,
        approvedTotal: 500,
        rejectedCount: 1,
        pendingCount: 2
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getPaymentStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAdminActivityLog', () => {
    test('retorna activity log con paginación', async () => {
      const req = { query: { page: '1', limit: '10' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '3' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      await getAdminActivityLog(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        logs: expect.any(Array),
        total: 3,
        page: 1
      }));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getAdminActivityLog(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
