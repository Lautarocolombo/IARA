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

  test('showToast con onRetry incluye botón reintentar', () => {
    document.body.innerHTML = '<div id="toastContainer"></div>';
    const uiModule = require('../../frontend/js/ui');
    const onRetry = jest.fn();
    uiModule.showToast('⚠️', 'Error', 'error', { onRetry, duration: 100 });
    const container = document.getElementById('toastContainer');
    expect(container.innerHTML).toContain('toast-retry');
    expect(container.innerHTML).toContain('Reintentar');
  });

  test('showToast con onRetry ejecuta onRetry al hacer click', () => {
    document.body.innerHTML = '<div id="toastContainer"></div>';
    const uiModule = require('../../frontend/js/ui');
    const onRetry = jest.fn();
    uiModule.showToast('⚠️', 'Error', 'error', { onRetry, duration: 0 });
    const container = document.getElementById('toastContainer');
    const retryBtn = container.querySelector('.toast-retry');
    retryBtn.click();
    expect(onRetry).toHaveBeenCalled();
  });

  test('initMobileNavbar toggle abre y cierra menú', () => {
    const uiModule = require('../../frontend/js/ui');
    const toggle = document.createElement('button');
    toggle.id = 'navbarToggle';
    toggle.className = 'navbar-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.id = 'navbarMenu';
    menu.className = 'navbar-menu';
    menu.innerHTML = '<a class="nav-link">Inicio</a>';
    document.body.appendChild(toggle);
    document.body.appendChild(menu);

    uiModule.initMobileNavbar();
    toggle.click();
    expect(menu.classList.contains('active')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(menu.classList.contains('active')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
