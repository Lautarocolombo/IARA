jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const { query } = require('../src/lib/db');
const logger = require('../src/lib/logger');
const { logAudit, auditMiddleware } = require('../src/lib/audit');

describe('audit', () => {
  describe('logAudit', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('inserts audit log with all fields', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logAudit({
        user: 'testuser',
        action: 'create',
        entityType: 'product',
        entityId: 123,
        details: 'Created product',
        ip: '192.168.1.1',
        tenantId: 'tenant1'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_log'),
        ['testuser', 'create', 'product', 123, 'Created product', '192.168.1.1', 'tenant1']
      );
    });

    test('uses defaults when fields are missing', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logAudit({
        action: 'delete',
        entityType: 'order'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_log'),
        ['system', 'delete', 'order', undefined, '', '', 'default']
      );
    });

    test('handles entityId = 0', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logAudit({
        user: 'user1',
        action: 'list',
        entityType: 'product',
        entityId: 0
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_log'),
        expect.arrayContaining(['user1', 'list', 'product', 0])
      );
    });

    test('handles DB error gracefully without throwing', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(logAudit({
        user: 'test',
        action: 'test',
        entityType: 'test'
      })).resolves.not.toThrow();
    });

    test('logs warning on DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await logAudit({
        user: 'test',
        action: 'test',
        entityType: 'test'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          err: 'DB error',
          audit: { action: 'test', entityType: 'test', entityId: undefined }
        }),
        'Error guardando audit log'
      );
    });

    test('uses empty string for details when not provided', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await logAudit({
        user: 'u1',
        action: 'a1',
        entityType: 'e1',
        entityId: 1
      });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['u1', 'a1', 'e1', 1, '', '', 'default'])
      );
    });
  });

  describe('auditMiddleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        params: {},
        body: {},
        headers: {},
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        user: { user: 'admin', tenant_id: 'default' }
      };
      mockRes = {
        json: jest.fn((body) => body),
        status: jest.fn(function(code) { this.statusCode = code; return this; })
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    test('calls next to continue middleware chain', async () => {
      const middleware = auditMiddleware('create', 'product');
      mockRes.json.mockReturnValue({});

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('logs audit on successful response (2xx)', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const middleware = auditMiddleware('create', 'product');
      mockReq.params.id = '42';

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({ success: true });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_log'),
        expect.arrayContaining([
          'admin',
          'create',
          'product',
          '42',
          'create product 42',
          '127.0.0.1',
          'default'
        ])
      );
    });

    test('logs audit with failed status on 4xx response', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const middleware = auditMiddleware('update', 'order');
      mockReq.params.id = '100';

      await middleware(mockReq, mockRes, mockNext);
      mockRes.status(400);
      await mockRes.json({ error: 'Bad request' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_log'),
        expect.arrayContaining([
          'admin',
          'update',
          'order',
          '100',
          'update order 100 (failed: 400)',
          '127.0.0.1',
          'default'
        ])
      );
    });

    test('logs audit with failed status on 5xx response', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const middleware = auditMiddleware('delete', 'category');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.status(500);
      await mockRes.json({ error: 'Server error' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_log'),
        expect.arrayContaining([
          'admin',
          'delete',
          'category',
          0,
          'delete category (failed: 500)',
          '127.0.0.1',
          'default'
        ])
      );
    });

    test('uses req.user for username when available', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.user = { user: 'customuser', tenant_id: 'tenant1' };
      const middleware = auditMiddleware('create', 'product');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['customuser', 'create', 'product'])
      );
    });

    test('falls back to "admin" when no user', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.user = null;
      const middleware = auditMiddleware('create', 'product');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['admin', 'create', 'product'])
      );
    });

    test('uses req.ip for IP address', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.ip = '10.0.0.1';
      const middleware = auditMiddleware('create', 'product');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), 'create', 'product', expect.any(String), expect.any(String), '10.0.0.1'])
      );
    });

    test('uses connection.remoteAddress when no req.ip', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.ip = undefined;
      mockReq.connection = { remoteAddress: '192.168.1.100' };
      const middleware = auditMiddleware('create', 'product');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), 'create', 'product', expect.any(String), expect.any(String), '192.168.1.100'])
      );
    });

    test('uses x-tenant-id header when available', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.headers['x-tenant-id'] = 'custom-tenant';
      const middleware = auditMiddleware('create', 'product');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), 'create', 'product', expect.any(String), expect.any(String), expect.any(String), 'custom-tenant'])
      );
    });

    test('uses orderId from params when id not present', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.params = { orderId: '555' };
      const middleware = auditMiddleware('create', 'order');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['admin', 'create', 'order', '555'])
      );
    });

    test('uses body.id as fallback for entityId', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      mockReq.body = { id: '777' };
      const middleware = auditMiddleware('create', 'product');

      await middleware(mockReq, mockRes, mockNext);
      await mockRes.json({});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['admin', 'create', 'product', '777'])
      );
    });

    test('does not log audit for 3xx responses', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const middleware = auditMiddleware('redirect', 'page');

      await middleware(mockReq, mockRes, mockNext);
      mockRes.status(302);
      await mockRes.json({});

      expect(query).not.toHaveBeenCalled();
    });

    test('returns original json response', async () => {
      const middleware = auditMiddleware('create', 'product');
      const responseBody = { data: 'test' };

      await middleware(mockReq, mockRes, mockNext);
      const result = await mockRes.json(responseBody);

      expect(result).toEqual(responseBody);
    });
  });
});