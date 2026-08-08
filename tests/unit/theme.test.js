/**
 * Tests unitarios para theme.js
 */

describe('theme.js', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    jest.resetModules();
  });

  test('initTheme aplica tema guardado o light por defecto', () => {
    const themeModule = require('../../frontend/js/theme');
    themeModule.initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('initTheme aplica tema dark guardado', () => {
    localStorage.setItem('ag_theme', 'dark');
    const themeModule = require('../../frontend/js/theme');
    themeModule.initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('toggleTheme cambia de light a dark', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const themeModule = require('../../frontend/js/theme');
    themeModule.toggleTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('ag_theme')).toBe('dark');
  });

  test('toggleTheme cambia de dark a light', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const themeModule = require('../../frontend/js/theme');
    themeModule.toggleTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('ag_theme')).toBe('light');
  });

  test('updateThemeUI actualiza aria-pressed y aria-label', () => {
    const themeModule = require('../../frontend/js/theme');
    const toggle = document.createElement('button');
    toggle.id = 'themeToggle';
    document.body.appendChild(toggle);
    themeModule.updateThemeUI('dark');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Cambiar a modo claro');
    themeModule.updateThemeUI('light');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Cambiar a modo oscuro');
  });
});
