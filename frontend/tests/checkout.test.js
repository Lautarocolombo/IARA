/**
 * @jest-environment jsdom
 */

describe('Frontend checkout', () => {
  beforeEach(() => {
    jest.resetModules();
    global.CONFIG = {
      CART: { SHIPPING_THRESHOLD: 15000, SHIPPING_COST: 3000, FREE_SHIPPING_TEXT: 'GRATIS' },
      API: { BASE: 'http://localhost' },
      CONTACT: { WHATSAPP: '+5493444634444' }
    };
    document.body.innerHTML = `
      <form id="shippingForm"></form>
      <div id="emptyCart" style="display:none"></div>
      <div id="checkoutContent" style="display:none"></div>
      <div id="summaryItems"></div>
      <div id="summaryTotals"></div>
      <div id="paymentInstructions" style="display:none"></div>
    `;
    window.getCart = () => [];
    window.formatARS = (n) => '$' + Number(n).toLocaleString('es-AR');
    window.updateCartBadge = () => {};
    window.startDataSync = () => {};
    window.stopDataSync = () => {};
    window.emitSync = () => {};
    window.onSyncMessage = () => {};
  });

  it('should load checkout.js without throwing', async () => {
    await require('../js/checkout.js');
    expect(true).toBe(true);
  });
});
