/**
 * @jest-environment jsdom
 */

describe('integrations 100%: analytics guards + reviews + whatsapp normalize', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    localStorage.clear();
    delete window.__analyticsDisabled;
    delete window.__pixelInit;
  });

  test('analytics no inyecta GA sin GOOGLE_ID', () => {
    global.CONFIG = { ANALYTICS: { GOOGLE_ID: '', FACEBOOK_PIXEL_ID: '' } };
    require('../../frontend/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.querySelector('script[data-ga]')).toBeNull();
  });

  test('analytics respeta consentimiento rechazado', () => {
    global.CONFIG = { ANALYTICS: { GOOGLE_ID: 'G-TEST', FACEBOOK_PIXEL_ID: '' } };
    localStorage.setItem('ag_cookie_consent', JSON.stringify({ essential: true, analytics: false }));
    require('../../frontend/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.querySelector('script[data-ga]')).toBeNull();
  });

  test('disable/enableAnalytics existen y alternan', () => {
    global.CONFIG = { ANALYTICS: { GOOGLE_ID: '', FACEBOOK_PIXEL_ID: '' } };
    require('../../frontend/js/analytics.js');
    expect(typeof window.disableAnalytics).toBe('function');
    expect(typeof window.enableAnalytics).toBe('function');
    window.disableAnalytics();
    expect(window.__analyticsDisabled).toBe(true);
    window.enableAnalytics();
    expect(window.__analyticsDisabled).toBe(false);
  });

  test('reviews: sin config oculta [data-review-link]', () => {
    const config = require('../../frontend/js/config.js');
    config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = '';
    config.CONFIG.REVIEWS.GOOGLE_PLACE_ID = '';
    document.body.innerHTML = '<a href="#" data-review-link>Escribir reseña</a>';
    config.applyReviewLinks();
    const el = document.querySelector('[data-review-link]');
    expect(el.style.display).toBe('none');
    expect(config.isReviewConfigured()).toBe(false);
  });

  test('reviews: con URL muestra [data-review-link]', () => {
    const config = require('../../frontend/js/config.js');
    config.CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = 'https://example.com/review';
    document.body.innerHTML = '<a href="#" data-review-link>Escribir reseña</a>';
    config.applyReviewLinks();
    const el = document.querySelector('[data-review-link]');
    expect(el.style.display).toBe('');
    expect(el.href).toBe('https://example.com/review');
    expect(config.isReviewConfigured()).toBe(true);
  });

  test('whatsapp normalize: 549 / 54 / 0 / 15 convergen a 54...', () => {
    const config = require('../../frontend/js/config.js');
    const n = window.normalizeWhatsAppPhone || config.normalizeWhatsAppPhone;
    expect(n('+5493444634444')).toBe('5493444634444');
    expect(n('+543444634444')).toBe('5493444634444');
    expect(n('03444634444')).toBe('5493444634444');
    const link = config.buildWhatsAppLink({ phone: '+5493444634444', message: 'hola' });
    expect(link).toContain('https://wa.me/5493444634444');
  });
});
