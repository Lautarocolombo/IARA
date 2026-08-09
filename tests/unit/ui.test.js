/**
 * Tests unitarios para ui.js (utilidades)
 */

describe('ui.js utilidades', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('escapeHtml escapa caracteres especiales', () => {
    const uiModule = require('../../frontend/js/ui');
    expect(uiModule.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(uiModule.escapeHtml('a & b')).toBe('a &amp; b');
    expect(uiModule.escapeHtml('"hola"')).toBe('&quot;hola&quot;');
    expect(uiModule.escapeHtml('it\'s')).toBe('it&#39;s');
    expect(uiModule.escapeHtml('')).toBe('');
    expect(uiModule.escapeHtml(null)).toBe('');
  });

  test('getFetchErrorMessage devuelve mensaje util', () => {
    const uiModule = require('../../frontend/js/ui');
    expect(uiModule.getFetchErrorMessage(new Error('Network error'))).toBe('Error de conexión. Intentá nuevamente.');
    expect(uiModule.getFetchErrorMessage({ message: 'HTTP 500', status: 500 })).toBe('Error del servidor. Intentá de nuevo en unos minutos.');
    expect(uiModule.getFetchErrorMessage({ message: 'HTTP 429', status: 429 })).toBe('Demasiadas solicitudes. Esperá un minuto y volvé a intentar.');
  });
});
