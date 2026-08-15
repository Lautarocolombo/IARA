jest.mock('validator', () => ({
  escape: jest.fn((input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  })
}));

const { xssClean, sanitizeBody } = require('../../src/middleware/xssClean');

describe('xssClean', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('xssClean', () => {
    test('limpia script tags', () => {
      expect(xssClean('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('limpia event handlers', () => {
      expect(xssClean('<img onerror="alert(1)" src="x">')).toBe('&lt;img onerror=&quot;alert(1)&quot; src=&quot;x&quot;&gt;');
    });

    test('limpia javascript: URLs', () => {
      expect(xssClean('<a href="javascript:alert(1)">link</a>')).toBe('&lt;a href=&quot;javascript:alert(1)&quot;&gt;link&lt;/a&gt;');
    });

    test('restaura slash escapado', () => {
      const result = xssClean('path/to/file');
      expect(result).toBe('path/to/file');
    });

    test('retorna valores no string sin cambios', () => {
      expect(xssClean(null)).toBeNull();
      expect(xssClean(undefined)).toBeUndefined();
      expect(xssClean(123)).toBe(123);
      expect(xssClean({})).toEqual({});
      expect(xssClean([])).toEqual([]);
    });

    test('limpia input vacío', () => {
      expect(xssClean('')).toBe('');
    });

    test('mantiene texto seguro', () => {
      expect(xssClean('Hola mundo')).toBe('Hola mundo');
    });

    test('limpia caracteres especiales', () => {
      expect(xssClean('A & B')).toBe('A &amp; B');
    });
  });

  describe('sanitizeBody', () => {
    test('sanitiza req.body', () => {
      const req = {
        body: { name: '<script>alert(1)</script>', age: 25 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      sanitizeBody(req, res, next);

      expect(req.body.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(req.body.age).toBe(25);
      expect(next).toHaveBeenCalled();
    });

    test('sanitiza req.query', () => {
      const req = {
        body: {},
        query: { search: '<img src=x onerror=alert(1)>' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      sanitizeBody(req, res, next);

      expect(req.query.search).toBe('&lt;img src=x onerror=alert(1)&gt;');
      expect(next).toHaveBeenCalled();
    });

    test('sanitiza req.params', () => {
      const req = {
        body: {},
        query: {},
        params: { id: '<script>alert(1)</script>' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      sanitizeBody(req, res, next);

      expect(req.params.id).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(next).toHaveBeenCalled();
    });

    test('sanitiza arrays anidados', () => {
      const req = {
        body: { items: ['<b>bold</b>', '<i>italic</i>'] }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      sanitizeBody(req, res, next);

      expect(req.body.items).toEqual(['&lt;b&gt;bold&lt;/b&gt;', '&lt;i&gt;italic&lt;/i&gt;']);
      expect(next).toHaveBeenCalled();
    });

    test('sanitiza objetos anidados', () => {
      const req = {
        body: { user: { name: '<script>alert(1)</script>' } }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      sanitizeBody(req, res, next);

      expect(req.body.user.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(next).toHaveBeenCalled();
    });

    test('maneja body/query/params nulos', () => {
      const req = {};
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();

      expect(() => sanitizeBody(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    test('llama a next siempre', () => {
      const req = { body: {} };
      const res = {};
      const next = jest.fn();

      sanitizeBody(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
