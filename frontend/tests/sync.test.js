/**
 * @jest-environment jsdom
 */

describe('Frontend data sync', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should load ui.js without throwing', async () => {
    await require('../js/ui.js');
    expect(true).toBe(true);
  });
});
