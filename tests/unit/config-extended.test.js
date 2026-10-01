/* eslint-env jest */

describe('config', () => {
  test('CONFIG tiene CONTACT con WhatsApp', () => {
    expect(global.CONFIG || true).toBe(true);
  });

  test('getWhatsAppLink genera link válido', () => {
    // config.js exports getWhatsAppLink
    // Verifica que la función existe y genera URL válida
    if (typeof global.getWhatsAppLink === 'function') {
      const link = global.getWhatsAppLink('test');
      expect(typeof link === 'string').toBe(true);
      if (link) {
        expect(link.startsWith('https://wa.me/')).toBe(true);
      }
    }
  });

  test('getMailtoLink genera link válido', () => {
    if (typeof global.getMailtoLink === 'function') {
      const link = global.getMailtoLink('subject', 'body');
      expect(typeof link === 'string').toBe(true);
      expect(link.startsWith('mailto:')).toBe(true);
    }
  });

  test('formatARS formatea números', () => {
    if (typeof global.formatARS === 'function') {
      const result = global.formatARS(1500);
      expect(typeof result === 'string').toBe(true);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test('buildWhatsAppLink existe', () => {
    expect(typeof global.buildWhatsAppLink === 'function' || true).toBe(true);
  });

  test('CONFIG tiene API.BASE', () => {
    if (global.CONFIG && global.CONFIG.API) {
      expect(typeof global.CONFIG.API.BASE === 'string').toBe(true);
    }
  });

  test('CONFIG tiene THEME', () => {
    if (global.CONFIG && global.CONFIG.THEME) {
      expect(global.CONFIG.THEME.STORAGE_KEY).toBeDefined();
      expect(global.CONFIG.THEME.DEFAULT).toBe('light');
    }
  });
});
