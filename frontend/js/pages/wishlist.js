(function() {
  initSiteHeader({ showBackButton: true });

  if (typeof initNavbarScroll === 'function') initNavbarScroll();
  if (typeof initMobileNavbar === 'function') initMobileNavbar();

  function renderWishlist() {
    const items = getWishlist();
    const grid = document.getElementById('wishlistGrid');
    const empty = document.getElementById('emptyWishlist');
    const content = document.getElementById('wishlistContent');

    if (items.length === 0) {
      empty.style.display = 'block';
      content.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    content.style.display = 'block';

    grid.innerHTML = items.map(product => `
      <div class="product-card reveal" data-product-id="${product.id}">
        <div class="product-image" aria-hidden="true">${product.image ? `${window.renderProductImage(product.image, product.name, { placeholder: '📿' })}` : (product.emoji || '📿')}</div>
        <div class="product-info">
          <span class="product-category">${product.category || ''}</span>
          <h3 class="product-name">${product.name}</h3>
          <p class="product-description">Producto artesanal único</p>
           <div class="product-footer">
             <span class="product-price">${formatARS(product.price)}</span>
             <div class="product-actions">
               <button class="btn-add-cart" data-product-id="${product.id}" data-product-name="${product.name.replace(/"/g, '&quot;')}" data-product-price="${product.price}" data-product-emoji="${product.emoji||'📿'}" data-product-image="${(product.image||'').replace(/"/g, '&quot;')}" data-product-stock="${product.stock||0}" aria-label="Agregar ${product.name} al carrito"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
               <button class="btn-outline btn-sm" data-action="remove-from-wishlist" data-product-id="${product.id}">Quitar</button>
             </div>
           </div>
         </div>
       </div>
    `).join('');
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderWishlist);
    } else {
      renderWishlist();
    }

    document.getElementById('wishlistGrid')?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-action="remove-from-wishlist"]');
      if (removeBtn) {
        const productId = Number(removeBtn.dataset.productId);
        if (typeof removeFromWishlist === 'function') removeFromWishlist(productId);
        renderWishlist();
        return;
      }

      const btn = e.target.closest('.btn-add-cart');
      if (!btn) return;
      e.preventDefault();
      const product = {
        id: Number(btn.dataset.productId),
        name: btn.dataset.productName,
        price: Number(btn.dataset.productPrice),
        emoji: btn.dataset.productEmoji || '📿',
        image: btn.dataset.productImage || '',
        stock: Number(btn.dataset.productStock || 0),
        unit: 'u',
        qty: 1
      };
      if (typeof addToCart === 'function') addToCart(product);
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'ag_wishlist') {
        renderWishlist();
      }
    });

    onSyncMessage('wishlist_updated', renderWishlist);
    onSyncMessage('products_updated', () => {
      if (typeof fetchProducts === 'function') {
        fetchProducts().then(() => renderWishlist());
      }
    });
    onSyncMessage('hero_updated', () => {
      if (typeof loadHeroCards === 'function') loadHeroCards();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
