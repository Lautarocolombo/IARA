function initPayment() {
  const checkoutBtn = document.getElementById('mp-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('', 'El pago se realiza por transferencia bancaria + WhatsApp. Completá los datos del checkout.', 'error');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPayment();
});
