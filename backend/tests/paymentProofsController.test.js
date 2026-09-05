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
  createReadStream: jest.fn(),
  readFileSync: jest.fn(() => Buffer.from('abc')),
  rmSync: jest.fn(),
  unlinkSync: jest.fn()
}));

jest.mock('path', () => ({
  dirname: jest.fn(() => '/tmp'),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn(),
  join: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  uploadProofToBlob: jest.fn(),
  processFile: jest.fn()
}));

const { query } = require('../src/lib/db');
const { uploadProofToBlob, processFile } = require('../src/lib/upload');
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
    uploadProofToBlob.mockReset();
    processFile.mockReset();
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
    test('sube comprobante exitosamente vía Vercel Blob', async () => {
      const req = {
        params: { orderId: '1' },
        file: { path: '/tmp/comprobantes/proof.jpg', mimetype: 'image/jpeg' },
        body: { customerName: 'Juan' },
        headers: { 'x-tenant-id': 'default' },
        user: {},
        ip: '127.0.0.1'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100, customer: '{"name":"Juan"}' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      uploadProofToBlob.mockResolvedValueOnce({ url: 'https://abc.blob.vercel-storage.com/comprobantes/x.jpg', isBlob: true });

      await uploadPaymentProof(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
      const insertCall = query.mock.calls.find((c) => c[0].includes('INSERT INTO payment_proofs'));
      expect(insertCall[1]).toEqual([1, 'Juan', 100, 'https://abc.blob.vercel-storage.com/comprobantes/x.jpg']);
      const lastCall = query.mock.calls[query.mock.calls.length - 1];
      expect(lastCall[0]).toContain('INSERT INTO activity_log');
      expect(lastCall[1]).toEqual(['cliente', 'upload', 'payment_proof', 1, 'Comprobante subido para pedido #1', '127.0.0.1', 'default']);
    });

    test('usa fallback base64 (processFile) si Blob no está disponible para imágenes', async () => {
      const req = {
        params: { orderId: '1' },
        file: { path: '/tmp/comprobantes/proof.jpg', mimetype: 'image/jpeg' },
        body: { customerName: 'Juan' },
        headers: { 'x-tenant-id': 'default' },
        user: {},
        ip: '127.0.0.1'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100, customer: '{"name":"Juan"}' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      uploadProofToBlob.mockResolvedValueOnce(null);
      processFile.mockResolvedValueOnce({ url: 'data:image/webp;base64,AAA' });

      await uploadPaymentProof(req, res);

      const insertCall = query.mock.calls.find((c) => c[0].includes('INSERT INTO payment_proofs'));
      expect(insertCall[1]).toEqual([1, 'Juan', 100, 'data:image/webp;base64,AAA']);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('usa base64 raw para PDF si Blob no está disponible', async () => {
      const req = {
        params: { orderId: '1' },
        file: { path: '/tmp/comprobantes/proof.pdf', mimetype: 'application/pdf' },
        body: { customerName: 'Juan' },
        headers: { 'x-tenant-id': 'default' },
        user: {},
        ip: '127.0.0.1'
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100, customer: '{"name":"Juan"}' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      uploadProofToBlob.mockResolvedValueOnce(null);

      await uploadPaymentProof(req, res);

      const insertCall = query.mock.calls.find((c) => c[0].includes('INSERT INTO payment_proofs'));
      expect(insertCall[1][3]).toBe('data:application/pdf;base64,YWJj');
      expect(res.status).toHaveBeenCalledWith(201);
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
        headers: { 'x-tenant-id': 'default' },
        ip: '127.0.0.1'
      };
      const res = {
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', order_id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await approvePaymentProof(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenCalledWith('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['confirmed', 1]);
      const approveCall = query.mock.calls[query.mock.calls.length - 1];
      expect(approveCall[0]).toContain('INSERT INTO activity_log');
      expect(approveCall[1]).toEqual(['admin', 'approve', 'payment_proof', 1, 'Comprobante aprobado para pedido #1', '127.0.0.1', 'default']);
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
        headers: { 'x-tenant-id': 'default' },
        ip: '127.0.0.1'
      };
      const res = {
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', order_id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await rejectPaymentProof(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenCalledWith('UPDATE payment_proofs SET status = $1, rejection_reason = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3 AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\')', ['rejected', 'Monto incorrecto', 1]);
      const rejectCall = query.mock.calls[query.mock.calls.length - 1];
      expect(rejectCall[0]).toContain('INSERT INTO activity_log');
      expect(rejectCall[1]).toEqual(['admin', 'reject', 'payment_proof', 1, 'Comprobante rechazado para pedido #1. Motivo: Monto incorrecto', '127.0.0.1', 'default']);
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
