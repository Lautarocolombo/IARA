/* ==================== WISHLIST PAGE ==================== */
(function () {
  'use strict';

  var WISHLIST_KEY = 'ag_wishlist';

  function formatPrice(amount) {
    if (typeof window.formatARS === 'function') return window.formatARS(amount);
    var n = Number(amount) || 0;
    try {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
    } catch (e) {
      return '$' + n;
    }
  }

  function escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function productImage(product) {
    var alt = product.name || 'Producto';
    var placeholder = product.emoji || '📿';
    if (typeof window.renderProductImage === 'function') {
      return window.renderProductImage(product.image || '', alt, { className: 'product-card-img', placeholder: placeholder });
    }
    var uri = (typeof window.getPlaceholderDataUri === 'function')
      ? window.getPlaceholderDataUri(placeholder)
      : '';
    return '<img src="' + uri + '" alt="' + escapeHtml(alt) + '" class="product-card-img" loading="lazy" decoding="async" />';
  }

  function whatsAppLink(product) {
    var phone = '';
    if (window.CONFIG && window.CONFIG.CONTACT) phone = String(window.CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
    var msg = encodeURIComponent('Hola! Me interesa el producto: ' + (product.name || 'Producto') + ' - ' + formatPrice(product.price));
    return 'https://wa.me/' + phone + '?text=' + msg;
  }

  function buildCard(product) {
    var id = product.id;
    var name = product.name || '';
    var price = Number(product.price) || 0;
    var stock = Number(product.stock) || 0;
    var catClass = product.category ? 'cat-' + product.category : '';
    var detailHref = 'product.html?id=' + encodeURIComponent(id);

    var imageHtml = productImage(product);
    var priceHtml = formatPrice(price);
    var waLink = whatsAppLink(product);
    var nameEsc = escapeHtml(name);
    var imgEsc = escapeHtml(product.image || '');
    var badgeHtml = product.badge ? '<span class="product-badge">' + escapeHtml(product.badge) + '</span>' : '';

    return ''
      + '<div class="product-card reveal" data-product-id="' + id + '">'
      + '  <a href="' + detailHref + '" style="text-decoration:none;color:inherit;">'
      + '    <div class="product-image ' + catClass + '" aria-hidden="true">' + imageHtml + '</div>'
      + '    ' + badgeHtml
      + '  </a>'
      + '  <div class="product-info">'
      + '    <span class="product-category">' + escapeHtml(product.category || '') + '</span>'
      + '    <a href="' + detailHref + '" style="text-decoration:none;color:inherit;">'
      + '      <h3 class="product-name">' + nameEsc + '</h3>'
      + '    </a>'
      + '    <p class="product-description">' + escapeHtml(product.description || 'Producto artesanal único') + '</p>'
      + '    <div class="product-footer">'
      + '      <span class="product-price">' + priceHtml + '</span>'
      + '      <a href="' + detailHref + '" class="product-cta">Ver producto</a>'
      + '    </div>'
      + '  </div>'
      + '  <div class="product-actions">'
      + '    <button class="btn-add-cart" data-product-id="' + id + '" data-product-name="' + nameEsc + '" data-product-price="' + price + '" data-product-emoji="' + escapeHtml(product.emoji || '📿') + '" data-product-image="' + imgEsc + '" data-product-stock="' + stock + '" aria-label="Agregar ' + nameEsc + ' al carrito">'
      + '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
      + '    </button>'
      + '    <button class="btn-wishlist" data-action="remove-from-wishlist" data-product-id="' + id + '" aria-label="Quitar ' + nameEsc + ' de favoritos" title="Quitar de favoritos">❤️</button>'
      + '    <a href="' + waLink + '" target="_blank" class="btn-outline btn-sm" rel="noopener" title="Consultar por WhatsApp">💬</a>'
      + '  </div>'
      + '</div>';
  }

  function showSkeleton(show) {
    var s = document.getElementById('wishlistSkeleton');
    if (s) s.style.display = show ? 'block' : 'none';
  }

  function renderWishlist() {
    var items = (typeof window.getWishlist === 'function') ? window.getWishlist() : [];
    var grid = document.getElementById('wishlistGrid');
    var empty = document.getElementById('emptyWishlist');
    var content = document.getElementById('wishlistContent');
    var errorBox = document.getElementById('wishlistError');

    try {
      showSkeleton(false);
      if (errorBox) errorBox.style.display = 'none';

      if (!items || !items.length) {
        if (empty) empty.style.display = 'block';
        if (content) content.style.display = 'none';
        if (grid) grid.innerHTML = '';
        if (typeof window.updateWishlistBadge === 'function') window.updateWishlistBadge();
        return;
      }

      if (empty) empty.style.display = 'none';
      if (content) content.style.display = 'block';
      if (!grid) return;

      grid.innerHTML = items.map(function (p) { return buildCard(p); }).join('');

      if (window.revealObserver) {
        grid.querySelectorAll('.reveal').forEach(function (el) {
          if (!el.classList.contains('visible')) window.revealObserver.observe(el);
        });
      }

      if (typeof window.updateWishlistBadge === 'function') window.updateWishlistBadge();
    } catch (err) {
      console.error('[Wishlist] Error renderizando la lista:', err);
      if (grid) grid.innerHTML = '';
      if (content) content.style.display = 'none';
      if (empty) empty.style.display = 'none';
      if (errorBox) errorBox.style.display = 'block';
    }
  }

  function removeItem(productId) {
    if (typeof window.removeFromWishlist === 'function') {
      window.removeFromWishlist(productId);
    } else {
      try {
        var current = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
        current = current.filter(function (it) { return it.id !== productId; });
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(current));
      } catch (e) { /* ignore */ }
    }
    renderWishlist();
  }

  function addToCartFromCard(btn) {
    var product = {
      id: Number(btn.getAttribute('data-product-id')),
      name: btn.getAttribute('data-product-name'),
      price: Number(btn.getAttribute('data-product-price')),
      emoji: btn.getAttribute('data-product-emoji') || '📿',
      image: btn.getAttribute('data-product-image') || '',
      stock: Number(btn.getAttribute('data-product-stock') || 0),
      unit: 'u',
      qty: 1
    };
    if (typeof window.addToCart === 'function') window.addToCart(product);
  }

  function init() {
    showSkeleton(true);
    renderWishlist();
    showSkeleton(false);

    if (typeof window.updateWishlistBadge === 'function') window.updateWishlistBadge();

    var grid = document.getElementById('wishlistGrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('[data-action="remove-from-wishlist"]');
        if (removeBtn) {
          var pid = Number(removeBtn.getAttribute('data-product-id'));
          removeItem(pid);
          return;
        }

        var cartBtn = e.target.closest('.btn-add-cart');
        if (cartBtn) {
          e.preventDefault();
          addToCartFromCard(cartBtn);
        }
      });
    }

    window.addEventListener('storage', function (e) {
      if (!e.key || e.key === WISHLIST_KEY) renderWishlist();
    });

    if (typeof window.onSyncMessage === 'function') {
      window.onSyncMessage('wishlist_updated', renderWishlist);
    }

    window.renderWishlist = renderWishlist;
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(init);
})();
