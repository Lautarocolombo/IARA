/**
 * @jest-environment jsdom
 */

describe('Frontend admin', () => {
  beforeEach(() => {
    jest.resetModules();
    global.CONFIG = { API: { BASE: 'http://localhost' } };
    document.body.innerHTML = '<div id="modalOverlay"></div><div id="loginOverlay"></div>';
  });

  it('should load admin.js without throwing', async () => {
    await require('../js/admin.js');
    expect(true).toBe(true);
  });
});
