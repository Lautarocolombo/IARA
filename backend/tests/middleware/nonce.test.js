const crypto = require('crypto');
const { nonceMiddleware } = require('../../src/middleware/nonce');

describe('nonce middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nonceMiddleware', () => {
    test('genera nonce y lo asigna a req y res.locals', async () => {
      const req = {};
      const res = {
        locals: {},
        send: jest.fn(function (body) { return body; }),
        write: jest.fn(function (chunk, encoding, callback) { if (callback) callback(); }),
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      expect(req.nonce).toBeDefined();
      expect(req.nonce.length).toBeGreaterThan(0);
      expect(res.locals.nonce).toBe(req.nonce);
      expect(next).toHaveBeenCalled();
    });

    test('genera nonces únicos en cada llamada', async () => {
      const req1 = {};
      const res1 = {
        locals: {},
        send: jest.fn(function (body) { return body; }),
        write: jest.fn(function (chunk, encoding, callback) { if (callback) callback(); }),
        getHeader: jest.fn(() => 'text/html')
      };
      const next1 = jest.fn();

      const req2 = {};
      const res2 = {
        locals: {},
        send: jest.fn(function (body) { return body; }),
        write: jest.fn(function (chunk, encoding, callback) { if (callback) callback(); }),
        getHeader: jest.fn(() => 'text/html')
      };
      const next2 = jest.fn();

      await nonceMiddleware(req1, res1, next1);
      await nonceMiddleware(req2, res2, next2);

      expect(req1.nonce).not.toBe(req2.nonce);
    });

    test('agrega nonce a tags script en res.send', async () => {
      const req = {
        nonce: 'test-nonce-123'
      };
      const originalSend = jest.fn(function (body) { return body; });
      const res = {
        locals: { nonce: 'test-nonce-123' },
        send: originalSend,
        write: jest.fn(function (chunk, encoding, callback) { if (callback) callback(); }),
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      const html = '<script src="app.js"></script><script>console.log(1)</script></head>';
      res.send(html);

      expect(originalSend).toHaveBeenCalledWith(
        expect.stringContaining('nonce="test-nonce-123"')
      );
    });

    test('agrega nonce a tags style en res.send', async () => {
      const req = {
        nonce: 'test-nonce-123'
      };
      const originalSend = jest.fn(function (body) { return body; });
      const res = {
        locals: { nonce: 'test-nonce-123' },
        send: originalSend,
        write: jest.fn(function (chunk, encoding, callback) { if (callback) callback(); }),
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      const html = '<style>body { color: red; }</style></head>';
      res.send(html);

      expect(originalSend).toHaveBeenCalledWith(
        expect.stringContaining('nonce="test-nonce-123"')
      );
    });

    test('agrega nonce a tags script en res.write', async () => {
      const req = {
        nonce: 'test-nonce-123'
      };
      const originalWrite = jest.fn(function (chunk, encoding, callback) { if (callback) callback(); });
      const res = {
        locals: { nonce: 'test-nonce-123' },
        send: jest.fn(function (body) { return body; }),
        write: originalWrite,
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      res.write('<script src="app.js"></script>', 'utf8');

      expect(originalWrite).toHaveBeenCalledWith(
        expect.stringContaining('nonce="test-nonce-123"'),
        'utf8',
        undefined
      );
    });

    test('no modifica body sin </head>', async () => {
      const req = {
        nonce: 'test-nonce-123'
      };
      const originalSend = jest.fn(function (body) { return body; });
      const res = {
        locals: { nonce: 'test-nonce-123' },
        send: originalSend,
        write: jest.fn(),
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      const html = '<html><body>Hello</body></html>';
      res.send(html);

      expect(originalSend).toHaveBeenCalledWith(html);
    });

    test('no modifica body si no hay nonce', async () => {
      const req = {};
      const originalSend = jest.fn(function (body) { return body; });
      const res = {
        locals: {},
        send: originalSend,
        write: jest.fn(),
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      const html = '<script src="app.js"></script></head>';
      res.send(html);

      expect(originalSend).toHaveBeenCalledWith(
        expect.stringContaining('nonce=')
      );
    });

    test('no modifica body que no es text/html', async () => {
      const req = {
        nonce: 'test-nonce-123'
      };
      const originalSend = jest.fn(function (body) { return body; });
      const res = {
        locals: { nonce: 'test-nonce-123' },
        send: originalSend,
        write: jest.fn(),
        getHeader: jest.fn(() => 'application/json')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      const json = '{"key":"value"}';
      res.send(json);

      expect(originalSend).toHaveBeenCalledWith(json);
    });

    test('no modifica writes que no son strings', async () => {
      const req = {
        nonce: 'test-nonce-123'
      };
      const originalWrite = jest.fn(function (chunk, encoding, callback) { if (callback) callback(); });
      const res = {
        locals: { nonce: 'test-nonce-123' },
        send: jest.fn(function (body) { return body; }),
        write: originalWrite,
        getHeader: jest.fn(() => 'text/html')
      };
      const next = jest.fn();

      await nonceMiddleware(req, res, next);

      const buffer = Buffer.from('<script>test</script>');
      res.write(buffer);

      expect(originalWrite).toHaveBeenCalledWith(buffer, undefined, undefined);
    });
  });
});
