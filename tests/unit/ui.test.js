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

  test('showToast crea un elemento toast en el DOM', () => {
    document.body.innerHTML = '<div id="toastContainer"></div>';
    const uiModule = require('../../frontend/js/ui');
    uiModule.showToast('⚠️', 'Mensaje de prueba', 'error', { duration: 100 });
    const container = document.getElementById('toastContainer');
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain('Mensaje de prueba');
  });

  test('showToast no hace nada si no existe el contenedor', () => {
    document.body.innerHTML = '';
    const uiModule = require('../../frontend/js/ui');
    expect(() => uiModule.showToast('⚠️', 'Mensaje', 'error')).not.toThrow();
  });

  test('escapeHtml devuelve string vacío para null', () => {
    const uiModule = require('../../frontend/js/ui');
    expect(uiModule.escapeHtml(null)).toBe('');
    expect(uiModule.escapeHtml(undefined)).toBe('');
    expect(uiModule.escapeHtml(123)).toBe('123');
  });
});
