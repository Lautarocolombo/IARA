'use strict';

(function() {
  window.updateCartDisplay = function() {
    var emptyCart = document.getElementById('emptyCart');
    var cartContent = document.getElementById('cartContent');
    var cartItems = typeof window.getCart === 'function' ? window.getCart() : [];

    if (cartItems.length === 0) {
      emptyCart.style.display = 'block';
      cartContent.style.display = 'none';
      return;
    }

    emptyCart.style.display = 'none';
    cartContent.style.display = 'block';

    var itemsContainer = document.getElementById('cartItems');
    itemsContainer.innerHTML = cartItems.map(function(item, index) {
      var catalogProduct = (typeof getProducts === 'function') ? getProducts().find(function(p) { return p.id === item.id; }) : null;
      var imgUrl = '';
      if (typeof window.getProductImageUrl === 'function') {
        imgUrl = catalogProduct ? window.getProductImageUrl(catalogProduct) : (item.image || '');
      } else {
        imgUrl = item.image || '';
      }

      return '<div class="cart-item reveal" style="animation-delay: ' + (index * 0.05) + 's" data-product-id="' + item.id + '">' +
        '<div class="item-image">' + window.renderProductImage(imgUrl, item.name, { placeholder: item.emoji || '🛍️' }) + '</div>' +
        '<div class="item-main">' +
          '<div class="item-details">' +
            '<h4>' + item.name + '</h4>' +
            (item.description ? '<p class="item-description">' + item.description + '</p>' : '') +
            '<p class="item-unit-price">' + formatARS(item.price) + ' c/u</p>' +
          '</div>' +
          '<div class="quantity-control">' +
            '<button type="button" data-action="cart" data-cart-action="qty" data-product-id="' + item.id + '" data-delta="-1">−</button>' +
            '<input type="number" value="' + item.qty + '" data-product-id="' + item.id + '">' +
            '<button type="button" data-action="cart" data-cart-action="qty" data-product-id="' + item.id + '" data-delta="1">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="item-subtotal">' + formatARS(item.price * item.qty) + '</div>' +
        '<button type="button" class="remove-btn" data-action="cart" data-cart-action="remove" data-product-id="' + item.id + '" title="Eliminar producto" aria-label="Eliminar ' + item.name + ' del carrito">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
        '</button>' +
      '</div>';
    }).join('');

    if (typeof initRevealAnimation === 'function') {
      initRevealAnimation();
    }

    var subtotal = cartItems.reduce(function(sum, item) { return sum + (item.price * item.qty); }, 0);
    var shipping = subtotal > CONFIG.CART.SHIPPING_THRESHOLD ? 0 : CONFIG.CART.SHIPPING_COST;
    var total = subtotal + shipping;

    var subtotalEl = document.getElementById('subtotal');
    var shippingEl = document.getElementById('shipping');
    var totalEl = document.getElementById('total');
    var shippingText = document.getElementById('shippingText');
    var hint = document.getElementById('shippingFreeHint');
    var progressWrap = document.getElementById('freeShippingProgress');
    var progressFill = document.getElementById('freeShippingFill');
    var progressText = document.getElementById('freeShippingText');

    if (subtotalEl) subtotalEl.textContent = formatARS(subtotal);
    if (shippingEl) shippingEl.textContent = shipping === 0 ? CONFIG.CART.FREE_SHIPPING_TEXT : formatARS(shipping);
    if (totalEl) totalEl.textContent = formatARS(total);
    if (shippingText) shippingText.textContent = formatARS(shipping);
    if (hint) hint.style.display = shipping === 0 ? 'inline' : 'none';

    if (progressWrap && progressFill && progressText) {
      if (shipping === 0) {
        progressWrap.style.display = 'none';
      } else {
        progressWrap.style.display = 'block';
        var threshold = Number(CONFIG.CART.SHIPPING_THRESHOLD) || 0;
        var remaining = threshold - subtotal;
        var pct = threshold > 0 ? Math.min(100, Math.max(0, (subtotal / threshold) * 100)) : 100;
        progressFill.style.width = pct + '%';
        progressText.textContent = 'Te faltan ' + formatARS(remaining) + ' para envío gratis';
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (typeof initNavbarScroll === 'function') initNavbarScroll();
    if (typeof initMobileNavbar === 'function') initMobileNavbar();

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-action="cart"]');
      if (!btn) return;

      var action = btn.getAttribute('data-cart-action');
      var id = parseInt(btn.getAttribute('data-product-id'), 10);
      var delta = parseInt(btn.getAttribute('data-delta'), 10) || 0;

      if (action === 'qty' && !isNaN(id)) {
        var input = document.querySelector('input[type="number"][data-product-id="' + id + '"]');
        var current = input ? parseInt(input.value, 10) : 1;
        var next = isNaN(delta) ? current : current + delta;
        if (!isNaN(delta) && input) {
          input.value = next;
        }
        if (typeof updateCartQty === 'function') {
          updateCartQty(id, isNaN(delta) ? current : next);
        }
        if (typeof window.updateCartDisplay === 'function') {
          window.updateCartDisplay();
        }
      } else if (action === 'remove' && !isNaN(id)) {
        var cartItem = btn.closest('.cart-item');
        if (cartItem) {
          cartItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          cartItem.style.opacity = '0';
          cartItem.style.transform = 'translateX(20px)';
        }

        setTimeout(function() {
          if (typeof removeFromCart === 'function') {
            removeFromCart(id);
          }
          if (typeof window.updateCartDisplay === 'function') {
            window.updateCartDisplay();
          }
          if (typeof showToast === 'function') {
            showToast('', 'Producto eliminado');
          }
        }, 300);
      }
    });

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-action="goto-checkout"]');
      if (btn) {
        window.location.href = 'checkout.html';
      }
    });

    document.addEventListener('change', function(e) {
      if (e.target.matches('input[type="number"][data-product-id]')) {
        var id = parseInt(e.target.getAttribute('data-product-id'), 10);
        if (!isNaN(id) && typeof updateCartQty === 'function') {
          updateCartQty(id, e.target.value);
        }
        if (typeof window.updateCartDisplay === 'function') {
          window.updateCartDisplay();
        }
      }
    });

    window.addEventListener('storage', function() {
      if (typeof window.updateCartDisplay === 'function') {
        window.updateCartDisplay();
      }
    });

    if (typeof loadPaymentConfig === 'function') {
      loadPaymentConfig();
    }
    if (typeof initSSESync === 'function') initSSESync();
    if (typeof window.updateCartDisplay === 'function') {
      window.updateCartDisplay();
    }
    if (typeof startDataSync === 'function') {
      startDataSync('cart', window.updateCartDisplay);
    }

    if (typeof onSyncMessage === 'function') {
      onSyncMessage('cart_updated', window.updateCartDisplay);
      onSyncMessage('products_updated', function() {
        if (typeof fetchProducts === 'function') {
          fetchProducts().then(function() {
            if (typeof window.updateCartDisplay === 'function') window.updateCartDisplay();
          });
        }
      });
      onSyncMessage('hero_updated', function() {
        if (typeof loadHeroCards === 'function') loadHeroCards();
      });
    }
  }
})();
