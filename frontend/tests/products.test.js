/**
 * @jest-environment jsdom
 */

describe('Frontend products', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should load products.js without throwing', async () => {
    await require('../js/products.js');
    expect(true).toBe(true);
  });
});
