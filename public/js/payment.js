/* ==================== MERCADOPAGO INTEGRATION ==================== */

async function initMercadoPago() {
  if (typeof MercadoPago === 'undefined') return;
  new MercadoPago(CONFIG.PAYMENT.PUBLIC_KEY, {
    locale: 'es-AR'
  });
}


function getCartItemsForMercadoPago(cartItems) {
  return cartItems.map(item => ({
    title: item.name,
    unit_price: Number(item.price),
    quantity: Number(item.qty || 1),
    currency_id: 'ARS',
    description: item.description || 'Producto de Artesanía Gualeguay'
  }));
}

async function createPaymentPreference() {
  const cartItems = getCart();

  if (!cartItems || cartItems.length === 0) {
    showToast('', 'El carrito está vacío', 'error');
    return;
  }

  const items = getCartItemsForMercadoPago(cartItems);

  const total = cartItems.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);

  try {
    showToast('⏳', 'Procesando pago...');

    const csrfRes = await fetch(`${CONFIG.API_BASE_URL}/api/csrf-token`);
    const csrfData = await csrfRes.json().catch(() => ({}));
    const headers = { 'Content-Type': 'application/json', ...(csrfData.csrfToken ? { 'X-CSRF-Token': csrfData.csrfToken } : {}) };
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/payments/create-preference`, {
      // Cambiar por tu backend si corresponde
      method: 'POST',
      headers,
      body: JSON.stringify({
        items,
        payer: {
          name: 'Cliente',
          email: 'cliente@ejemplo.com'
        },
        external_reference: 'AG-' + Date.now(),
        back_urls: {
          success: window.location.origin + '/pages/success.html',
          failure: window.location.origin + '/pages/cart.html',
          pending: window.location.origin + '/pages/cart.html'
        },
        auto_return: 'approved',
        shipment: {
          free_shipping: total > 2000
        }
      })
    });

    const data = await response.json();

    if (data && data.init_point) {
      window.location.href = data.init_point; // Redirige a MercadoPago
    } else {
      showToast('', 'Error al generar el pago', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('', 'Error de conexión. Intenta nuevamente.', 'error');
  }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  initMercadoPago();

  const mpButton = document.getElementById('mp-checkout-btn');
  if (mpButton) {
    mpButton.addEventListener('click', createPaymentPreference);
  }
});

