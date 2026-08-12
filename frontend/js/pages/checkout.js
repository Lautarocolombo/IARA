'use strict';

(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (typeof initNavbarScroll === 'function') initNavbarScroll();
    if (typeof initMobileNavbar === 'function') initMobileNavbar();

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-copy-target]');
      if (btn) {
        var target = btn.getAttribute('data-copy-target');
        if (typeof copyTransferField === 'function') {
          copyTransferField(target);
        }
      }
    });

    if (typeof initSSESync === 'function') initSSESync();
    if (typeof startDataSync === 'function') {
      startDataSync('payment-config', async function() {
        var instructions = document.getElementById('paymentInstructions');
        if (instructions && instructions.style.display !== 'none') {
          if (typeof loadMpAlias === 'function') {
            await loadMpAlias();
          }
        }
      });
    }

    if (typeof onSyncMessage === 'function') {
      onSyncMessage('settings_updated', async function() {
        if (typeof loadMpAlias === 'function') {
          await loadMpAlias();
        }
      });

      onSyncMessage('hero_updated', function() {
        if (typeof loadHeroCards === 'function') loadHeroCards();
      });

      onSyncMessage('products_updated', function() {
        if (typeof fetchProducts === 'function') {
          fetchProducts().then(function() {
            if (typeof renderProducts === 'function') renderProducts(getProducts());
          });
        }
      });
    }
  }
})();
