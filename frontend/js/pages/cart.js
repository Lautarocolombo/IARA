'use strict';

(function() {
  var updateCartDisplay = function() {
    console.log('[cart] updateCartDisplay — inicio de render');
    var emptyCart = document.getElementById('emptyCart');
    var cartContent = document.getElementById('cartContent');
    // Acceso DEFENSIVO a getCart: en modo módulo el bare-name no siempre
    // resuelve a window; usamos window.getCart con fallback a [].
    var cartItems = (typeof window.getCart === 'function') ? window.getCart() : [];
    console.log('[cart] items en carrito:', cartItems.length);

    if (!emptyCart || !cartContent) {
      console.warn('[cart] contenedores emptyCart/cartContent no encontrados en el DOM');
    }

    if (cartItems.length === 0) {
      if (emptyCart) emptyCart.style.display = 'block';
      if (cartContent) cartContent.style.display = 'none';
      console.log('[cart] carrito vacío — se muestra estado vacío');
      return;
    }

    if (emptyCart) emptyCart.style.display = 'none';
    if (cartContent) cartContent.style.display = 'block';

    var itemsContainer = document.getElementById('cartItems');
    console.log('[cart] contenedor #cartItems encontrado:', !!itemsContainer);
    if (itemsContainer) {
      try {
        itemsContainer.innerHTML = cartItems.map(function(item, index) {
          var imageUrl = '';
          try {
            imageUrl = (item.image || window.getProductImageUrl(item) || '').trim();
          } catch (e) {
            imageUrl = '';
          }
          var html = '<div class="cart-item reveal" style="animation-delay: ' + (index * 0.05) + 's">' +
            '<div class="item-image">' + window.renderProductImage(imageUrl, item.name, { placeholder: item.emoji || '🛍️' }) + '</div>' +
            '<div class="item-details">' +
              '<h4>' + item.name + '</h4>' +
              (item.description ? '<p class="item-description">' + item.description + '</p>' : '') +
              '<p>' + window.formatARS(item.price) + ' c/u</p>' +
            '</div>' +
            '<div class="item-price">' + window.formatARS(item.price * item.qty) + '</div>' +
            '<div class="quantity-control">' +
              '<button type="button" data-action="cart" data-cart-action="qty" data-product-id="' + item.id + '" data-delta="-1">−</button>' +
              '<input type="number" value="' + item.qty + '" data-product-id="' + item.id + '">' +
              '<button type="button" data-action="cart" data-cart-action="qty" data-product-id="' + item.id + '" data-delta="1">+</button>' +
            '</div>' +
            '<button type="button" class="remove-btn" data-action="cart" data-cart-action="remove" data-product-id="' + item.id + '" title="Eliminar producto" aria-label="Eliminar ' + item.name + ' del carrito">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
            '</button>' +
          '</div>';
          return html;
        }).join('');
        console.log('[cart] render ejecutado OK — items renderizados:', cartItems.length);
      } catch (err) {
        console.error('[cart] error renderizando la lista de items:', err);
        itemsContainer.innerHTML = '<p class="cart-render-error" style="padding:2rem;text-align:center;color:var(--text-muted);">No se pudieron cargar los productos del carrito. Probá recargar la página.</p>';
      }
    } else {
      console.error('[cart] #cartItems no encontrado en el DOM — no se pudo renderizar la lista');
    }

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

    if (subtotalEl) subtotalEl.textContent = window.formatARS(subtotal);
    if (shippingEl) shippingEl.textContent = shipping === 0 ? CONFIG.CART.FREE_SHIPPING_TEXT : window.formatARS(shipping);
    if (totalEl) totalEl.textContent = window.formatARS(total);
    if (shippingText) shippingText.textContent = window.formatARS(shipping);
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
        progressText.textContent = 'Te faltan ' + window.formatARS(remaining) + ' para envío gratis';
      }
    }
  };

  window.updateCartDisplay = updateCartDisplay;

   function init() {
    console.log('[cart] init — página carrito inicializada');
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
        console.log('[cart] click qty — id:', id, 'delta:', delta, 'next:', next);
        if (typeof window.updateCartQty === 'function') {
          window.updateCartQty(id, isNaN(delta) ? current : next);
        } else {
          console.error('[cart] updateCartQty NO disponible en window — clic qty sin efecto (causa raíz: cart.js no expone la función en modo módulo)');
        }
        updateCartDisplay();
      } else if (action === 'remove' && !isNaN(id)) {
        console.log('[cart] click remove — id:', id);
        if (typeof window.removeFromCart === 'function') {
          window.removeFromCart(id);
        } else {
          console.error('[cart] removeFromCart NO disponible en window — clic eliminar sin efecto (causa raíz: cart.js no expone la función en modo módulo)');
        }
        updateCartDisplay();
        if (typeof window.showToast === 'function') {
          window.showToast('', 'Producto eliminado');
        }
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
        var val = e.target.value;
        console.log('[cart] change qty — id:', id, 'value:', val);
        if (!isNaN(id) && typeof window.updateCartQty === 'function') {
          window.updateCartQty(id, val);
        } else if (!isNaN(id)) {
          console.error('[cart] updateCartQty NO disponible en window — change qty sin efecto');
        }
        updateCartDisplay();
      }
    });

     window.addEventListener('storage', function() {
       console.log('[cart] evento storage detectado — re-render');
       updateCartDisplay();
     });

    if (typeof loadPaymentConfig === 'function') {
      loadPaymentConfig();
    }
    if (typeof initSSESync === 'function') initSSESync();
    updateCartDisplay();
    if (typeof startDataSync === 'function') {
      startDataSync('cart', updateCartDisplay);
    }

    if (typeof onSyncMessage === 'function') {
      onSyncMessage('cart_updated', updateCartDisplay);
      onSyncMessage('products_updated', function() {
        if (typeof fetchProducts === 'function') {
          fetchProducts().then(function() {
            updateCartDisplay();
          });
        }
      });
      onSyncMessage('hero_updated', function() {
        if (typeof loadHeroCards === 'function') loadHeroCards();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
