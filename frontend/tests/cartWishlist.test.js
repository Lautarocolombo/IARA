/**
 * @jest-environment jsdom
 */

describe('Frontend cart and wishlist', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.CONFIG = {
      CART: {
        STORAGE_KEY: 'ag_cart',
        SHIPPING_THRESHOLD: 15000,
        SHIPPING_COST: 3000,
        FREE_SHIPPING_TEXT: 'GRATIS'
      },
      API: { BASE: 'http://localhost' },
      CONTACT: { WHATSAPP: '+5493444634444' },
      ANIMATIONS: { TOAST_DURATION: 3000 }
    };
  });

  it('should load cart module without throwing', async () => {
    await require('../js/cart.js');
    expect(true).toBe(true);
  });

  it('should load wishlist module without throwing', async () => {
    await require('../js/wishlist.js');
    expect(true).toBe(true);
  });
});
