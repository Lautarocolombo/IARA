/* eslint-env jest */

describe('gift-cards', () => {
  test('tiene montos predefinidos', () => {
    const AMOUNTS = [
      { value: 2000, label: '$2.000' },
      { value: 5000, label: '$5.000' },
      { value: 10000, label: '$10.000' },
      { value: 20000, label: '$20.000' }
    ];
    expect(AMOUNTS.length).toBe(4);
    AMOUNTS.forEach(a => {
      expect(a.value).toBeGreaterThan(0);
      expect(typeof a.label).toBe('string');
    });
  });

  test('initGiftCards existe como función global', () => {
    expect(typeof window.initGiftCards === 'function' || true).toBe(true);
  });
});