function initPayment() {
  var mpBtn = document.getElementById('mp-checkout-btn');
  if (mpBtn) {
    mpBtn.style.display = 'none';
  }

  var mpContainer = document.getElementById('mp-checkout-container');
  if (mpContainer) {
    mpContainer.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initPayment();
});
