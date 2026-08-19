/**
 * Tests unitarios para config.js (frontend)
 */

describe('config.js', () => {
  let config;

  beforeEach(() => {
    jest.resetModules();
    config = require('../../frontend/js/config');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CONFIG object', () => {
    test('expone CONFIG con estructura esperada', () => {
      expect(config.CONFIG).toBeDefined();
      expect(config.CONFIG.CONTACT).toBeDefined();
      expect(config.CONFIG.CART).toBeDefined();
      expect(config.CONFIG.BUSINESS).toBeDefined();
    });

    test('CONTACT tiene WhatsApp con dígitos', () => {
      expect(config.CONFIG.CONTACT.WHATSAPP).toMatch(/\d+/);
    });

    test('BUSINESS.NAME es string no vacío', () => {
      expect(typeof config.CONFIG.BUSINESS.NAME).toBe('string');
      expect(config.CONFIG.BUSINESS.NAME.length).toBeGreaterThan(0);
    });

    test('CART tiene SHIPPING_THRESHOLD y SHIPPING_COST', () => {
      expect(config.CONFIG.CART.SHIPPING_THRESHOLD).toBeDefined();
      expect(config.CONFIG.CART.SHIPPING_COST).toBeDefined();
    });
  });

  describe('getWhatsAppLink', () => {
    test('genera link base de WhatsApp con mensaje default', () => {
      const link = config.getWhatsAppLink();
      expect(link).toContain('https://wa.me/');
      expect(link).toContain('text=');
    });

    test('usa el número de WhatsApp de CONFIG', () => {
      const link = config.getWhatsAppLink();
      const phone = config.CONFIG.CONTACT.WHATSAPP.replace(/[^\d]/g, '');
      expect(link).toContain(phone);
    });

    test('usa mensaje default cuando no se pasa mensaje', () => {
      const link = config.getWhatsAppLink();
      expect(link).toContain(encodeURIComponent('Hola! Quisiera más información sobre tus productos.'));
    });

    test('usa mensaje personalizado cuando se pasa', () => {
      const link = config.getWhatsAppLink('Hola, quiero consultar');
      expect(link).toContain(encodeURIComponent('Hola, quiero consultar'));
    });

    test('usa mensaje default cuando se pasa string vacío', () => {
      const link = config.getWhatsAppLink('');
      expect(link).toContain(encodeURIComponent('Hola! Quisiera más información sobre tus productos.'));
    });
  });

  describe('getMailtoLink', () => {
    test('genera link mailto con email de CONFIG', () => {
      const link = config.getMailtoLink('Test Subject', 'Test body');
      expect(link).toContain('mailto:');
      expect(link).toContain(config.CONFIG.CONTACT.EMAIL);
    });

    test('encodea subject y body', () => {
      const link = config.getMailtoLink('Asunto & Prueba', 'Cuerpo <test>');
      expect(link).toContain('subject=' + encodeURIComponent('Asunto & Prueba'));
      expect(link).toContain('body=' + encodeURIComponent('Cuerpo <test>'));
    });

    test('usa strings vacíos por defecto', () => {
      const link = config.getMailtoLink();
      expect(link).toContain('mailto:');
    });
  });

  describe('getGoogleWriteReviewLink', () => {
    test('retorna "#" si no hay GOOGLE_WRITE_REVIEW_URL ni GOOGLE_PLACE_ID', () => {
      const originalUrl = config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL;
      const originalPlaceId = config.CONFIG.REVIEWS.GOOGLE_PLACE_ID;
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = '';
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = '';
      const link = config.getGoogleWriteReviewLink();
      expect(link).toBe('#');
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = originalUrl;
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = originalPlaceId;
    });

    test('prioriza GOOGLE_WRITE_REVIEW_URL sobre Place ID', () => {
      const originalUrl = config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL;
      const originalPlaceId = config.CONFIG.REVIEWS.GOOGLE_PLACE_ID;
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = 'https://example.com/review';
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = 'placetest123';
      const link = config.getGoogleWriteReviewLink();
      expect(link).toBe('https://example.com/review');
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = originalUrl;
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = originalPlaceId;
    });

    test('genera link con Place ID cuando no hay URL directa', () => {
      const originalUrl = config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL;
      const originalPlaceId = config.CONFIG.REVIEWS.GOOGLE_PLACE_ID;
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = '';
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = 'ChIJabc123';
      const link = config.getGoogleWriteReviewLink();
      expect(link).toContain('https://search.google.com/local/writereview');
      expect(link).toContain('placeid=' + encodeURIComponent('ChIJabc123'));
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = originalUrl;
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = originalPlaceId;
    });

    test('retorna "#" si Place ID tiene solo espacios', () => {
      const originalUrl = config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL;
      const originalPlaceId = config.CONFIG.REVIEWS.GOOGLE_PLACE_ID;
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = '';
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = '   ';
      const link = config.getGoogleWriteReviewLink();
      expect(link).toBe('#');
      config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = originalUrl;
      config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = originalPlaceId;
    });
  });

  describe('formatARS', () => {
    test('formatea número entero como moneda ARS', () => {
      const result = config.formatARS(1500);
      expect(result).toContain('1.500');
    });

    test('formatea número decimal', () => {
      const result = config.formatARS(1500.50);
      expect(result).toContain('1.500');
    });

    test('formatea cero', () => {
      const result = config.formatARS(0);
      expect(result).toBeDefined();
    });

    test('retorna string con $ en fallback', () => {
      const originalFormatter = Intl.NumberFormat;
      Intl.NumberFormat = function () {
        throw new Error('fail');
      };
      try {
        const result = config.formatARS('test');
        expect(result).toBe('$test');
      } finally {
        Intl.NumberFormat = originalFormatter;
      }
    });
  });
});
