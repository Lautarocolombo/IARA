(function() {
  initSiteHeader({ showBackButton: true });

  async function loadProduct() {
    const container = document.getElementById('productContent');
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    if (!productId) {
      container.innerHTML = '<p>Producto no encontrado.</p>';
      return;
    }
    try {
      const [productRes, reviewsRes] = await Promise.all([
        window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}`, {}, 2, 1000),
        window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/reviews`, {}, 2, 1000)
      ]);
      const reviewsData = reviewsRes ? await reviewsRes.json() : [];
      let product = null;
      if (productRes && productRes.ok) {
        product = await productRes.json();
      } else {
        const fallbackRes = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products`, {}, 2, 1000);
        const productData = fallbackRes ? await fallbackRes.json() : [];
        const products = Array.isArray(productData) && productData.length ? productData : (typeof defaultProducts !== 'undefined' ? defaultProducts : []);
        product = products.find(p => p.id === Number(productId));
      }
      if (!product) {
        container.innerHTML = '<p>Producto no encontrado.</p>';
        return;
      }
       const images = Array.isArray(product.images) && product.images.length
             ? product.images
             : [{ url: window.getProductImageUrl(product) || '../assets/placeholder-product.svg', es_principal: true }];
        const principalImage = images.find(i => i.es_principal) || images[0];
        const thumbsHtml = images.map((img, i) =>
          `${window.renderProductImage(img.url, product.name + ' - imagen ' + (i + 1), { placeholder: '📿' })}`
        ).join('');
        const imageHtml = images.length
          ? `<div class="product-image-gallery"><div class="product-image-main">${window.renderProductImage(principalImage ? principalImage.url : '', product.name, { id: 'productMainImage', lazy: false, placeholder: '📿' })}</div><div class="product-image-thumbs" id="productThumbs">${thumbsHtml}</div></div>`
           : `${window.renderProductImage('', product.name, { style: 'width:100%;aspect-ratio:1;object-fit:contain;object-position:center;', placeholder: '📿' })}`;
          const freeShippingThreshold = Number(CONFIG.CART.SHIPPING_THRESHOLD) || 0;
          const freeShippingHint = document.getElementById('freeShippingHint');
          const freeShippingText = document.getElementById('freeShippingText');
          const freeShippingFill = document.getElementById('freeShippingFill');
          const cartItems = window.getCart ? window.getCart() : [];
          const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
          const remaining = Math.max(0, freeShippingThreshold - cartSubtotal);
          if (freeShippingHint && freeShippingText && freeShippingFill) {
            if (remaining <= 0 && freeShippingThreshold > 0) {
              freeShippingHint.style.display = 'inline';
              freeShippingHint.textContent = '🎉 ' + (CONFIG.CART.FREE_SHIPPING_TEXT || 'Envío gratis');
              freeShippingText.textContent = 'Alcanzaste el envío gratis';
              freeShippingFill.style.width = '100%';
            } else if (freeShippingThreshold > 0) {
              freeShippingHint.style.display = 'none';
              freeShippingText.textContent = 'Te faltan ' + window.formatARS(remaining) + ' para envío gratis';
              const pct = freeShippingThreshold > 0 ? Math.min(100, Math.max(0, (cartSubtotal / freeShippingThreshold) * 100)) : 100;
              freeShippingFill.style.width = pct + '%';
            } else {
              freeShippingHint.style.display = 'none';
              freeShippingText.textContent = '';
              freeShippingFill.style.width = '0%';
            }
          }
          container.innerHTML = `
        <div class="product-detail-grid">
          <div class="product-image-large" aria-hidden="true">${imageHtml}</div>
          <div>
            <span class="product-category">${product.category || ''}</span>
            <h1 class="product-detail-title">${product.name}</h1>
            <p class="product-detail-desc">${product.description || ''}</p>
            <p class="product-detail-price">${formatARS(product.price)}</p>
            <div id="freeShippingHint" class="free-shipping-hint" style="display:none;"></div>
            <div id="freeShippingProgress" class="free-shipping-progress" style="display:none;">
              <div class="free-shipping-progress-bar">
                <div class="free-shipping-progress-fill" id="freeShippingFill"></div>
              </div>
              <p class="free-shipping-progress-text" id="freeShippingText"></p>
            </div>
            <div class="product-detail-actions">
              <button class="btn-primary btn-add-cart" data-product-id="${product.id}" data-product-name="${product.name.replace(/"/g, '&quot;')}" data-product-price="${product.price}" data-product-emoji="${product.emoji||'📿'}" data-product-image="${(product.image||'').replace(/"/g, '&quot;')}" data-product-stock="${product.stock||0}">Agregar al carrito</button>
              <button class="btn-outline btn-wishlist-detail" data-product-id="${product.id}" data-product-name="${product.name.replace(/"/g, '&quot;')}" data-product-price="${product.price}" data-product-emoji="${product.emoji||'📿'}" data-product-image="${(product.image||'').replace(/"/g, '&quot;')}" aria-label="Favoritos">${window.isInWishlist(product.id) ? '❤️' : '🤍'}</button>
              <a href="https://wa.me/${CONFIG.CONTACT.WHATSAPP.replace(/[^\d]/g,'')}?text=Hola! Me interesa el producto: ${product.name}" target="_blank" class="btn-outline" rel="noopener">Consultar por WhatsApp</a>
            </div>
          </div>
        </div>
        <div class="reviews-section">
          <h2>Reseñas</h2>
          <div id="reviewsList">
             ${reviewsData.length ? reviewsData.map(r => `
               <div class="review-card">
                 <div class="review-header">
                   ${r.avatar ? `<img src="${escapeHtml(r.avatar)}" class="review-avatar" alt="${escapeHtml(r.name || '')}" loading="lazy" />` : ''}
                   <span class="review-name">${r.name || 'Anónimo'}</span>
                   <span class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                 </div>
                 <p class="review-comment">${r.comment}</p>
               </div>
             `).join('') : '<p>Aún no hay reseñas para este producto.</p>'}
          </div>
           <div class="review-form">
             <h3>Dejá tu reseña</h3>
             <div class="form-group">
               <label for="reviewName">Nombre</label>
               <input type="text" id="reviewName" placeholder="Tu nombre" rows="3" />
             </div>
             <div class="form-group">
               <label for="reviewAvatar">Avatar (opcional)</label>
               <input type="file" id="reviewAvatar" accept="image/jpeg,image/png,image/webp,image/gif" />
             </div>
             <div class="rating-input" id="ratingInput">
               ${[1,2,3,4,5].map(i => `<button type="button" data-rating="${i}" aria-label="Calificación ${i} estrellas">★</button>`).join('')}
             </div>
             <textarea id="reviewComment" placeholder="Tu opinión..." rows="3"></textarea>
               <button class="btn-primary btn-sm" data-action="submit-review">Enviar reseña</button>
           </div>
         </div>
        `;
        let selectedRating = 0;
        const thumbs = document.querySelectorAll('#productThumbs img');
        if (thumbs.length) {
          thumbs.forEach((t, i) => {
            if (i === 0) t.classList.add('active');
            t.addEventListener('click', () => {
              const main = document.getElementById('productMainImage');
              if (!main) return;
              main.src = t.src;
              thumbs.forEach(tb => tb.classList.remove('active'));
              t.classList.add('active');
            });
          });
        }
       document.querySelectorAll('#ratingInput button').forEach(btn => {
         btn.addEventListener('click', () => {
           selectedRating = Number(btn.dataset.rating);
           document.querySelectorAll('#ratingInput button').forEach(b => {
             b.classList.toggle('active', Number(b.dataset.rating) <= selectedRating);
           });
         });
       });
       window.submitReview = async (id) => {
         const name = document.getElementById('reviewName').value.trim();
         const comment = document.getElementById('reviewComment').value.trim();
         if (!selectedRating || !comment) {
           showToast('', 'Completá la calificación y el comentario', 'error');
           return;
         }
         const avatarInput = document.getElementById('reviewAvatar');
         const formData = new FormData();
         formData.append('name', name);
         formData.append('comment', comment);
         formData.append('rating', String(selectedRating));
         if (avatarInput && avatarInput.files && avatarInput.files[0]) {
           formData.append('avatar', avatarInput.files[0]);
         }
          try {
            const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${id}/reviews`, {
              method: 'POST',
              body: formData
            }, 2, 1000);
            if (!res || !res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || 'Error al enviar la reseña');
            }
           showToast('', '¡Reseña enviada! Gracias.', 'success');
           document.getElementById('reviewName').value = '';
           document.getElementById('reviewComment').value = '';
           document.getElementById('reviewAvatar').value = '';
           selectedRating = 0;
           document.querySelectorAll('#ratingInput button').forEach(b => b.classList.remove('active'));
           loadProduct();
         } catch (error) {
           console.error(error);
           showToast('', window.getFetchErrorMessage(error) || 'Error de conexión. Intentá nuevamente.', 'error');
         }
       };
     } catch (err) {
       container.innerHTML = '<div class="empty-state"><h3>Error al cargar el producto</h3><p>Intentá recargar la página o volvé al <a href="../index.html#catalog">catálogo</a>.</p></div>';
     }
   }

  function init() {
    document.addEventListener('DOMContentLoaded', loadProduct);

    document.getElementById('productContent')?.addEventListener('click', (e) => {
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
      if (typeof window.addToCart === 'function') {
        window.addToCart(product);
        setTimeout(updateFreeShippingHint, 100);
      }
    });

    function updateFreeShippingHint() {
      const freeShippingThreshold = Number(CONFIG.CART.SHIPPING_THRESHOLD) || 0;
      const freeShippingHint = document.getElementById('freeShippingHint');
      const freeShippingText = document.getElementById('freeShippingText');
      const freeShippingFill = document.getElementById('freeShippingFill');
      const cartItems = window.getCart ? window.getCart() : [];
      const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const remaining = Math.max(0, freeShippingThreshold - cartSubtotal);
      if (freeShippingHint && freeShippingText && freeShippingFill) {
        if (remaining <= 0 && freeShippingThreshold > 0) {
          freeShippingHint.style.display = 'inline';
          freeShippingHint.textContent = '🎉 ' + (CONFIG.CART.FREE_SHIPPING_TEXT || 'Envío gratis');
          freeShippingText.textContent = 'Alcanzaste el envío gratis';
          freeShippingFill.style.width = '100%';
        } else if (freeShippingThreshold > 0) {
          freeShippingHint.style.display = 'none';
          freeShippingText.textContent = 'Te faltan ' + window.formatARS(remaining) + ' para envío gratis';
          const pct = freeShippingThreshold > 0 ? Math.min(100, Math.max(0, (cartSubtotal / freeShippingThreshold) * 100)) : 100;
          freeShippingFill.style.width = pct + '%';
        } else {
          freeShippingHint.style.display = 'none';
          freeShippingText.textContent = '';
          freeShippingFill.style.width = '0%';
        }
      }
    }

    document.getElementById('productContent')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-wishlist-detail');
      if (!btn) return;
      e.preventDefault();
      const product = {
        id: Number(btn.dataset.productId),
        name: btn.dataset.productName,
        price: Number(btn.dataset.productPrice),
        emoji: btn.dataset.productEmoji || '📿',
        image: btn.dataset.productImage || ''
      };
      if (window.isInWishlist(product.id)) {
        window.removeFromWishlist(product.id);
        btn.textContent = '🤍';
        btn.setAttribute('aria-label', 'Agregar a favoritos');
      } else {
        window.addToWishlist(product);
        btn.textContent = '❤️';
        btn.setAttribute('aria-label', 'Quitar de favoritos');
      }
    });

    document.getElementById('productContent')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="submit-review"]');
      if (!btn) return;
      const params = new URLSearchParams(window.location.search);
      const productId = params.get('id');
      if (productId && typeof submitReview === 'function') {
        submitReview(Number(productId));
      }
    });

    if (typeof initSSESync === 'function') initSSESync();
    if (typeof startDataSync === 'function') startDataSync('product-detail', loadProduct);
    if (typeof onSyncMessage === 'function') onSyncMessage('products_updated', () => {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get('id');
      if (productId) {
        loadProduct();
      }
    });

    if (typeof onSyncMessage === 'function') onSyncMessage('hero_updated', () => {
      if (typeof loadHeroCards === 'function') loadHeroCards();
    });

    if (typeof onSyncMessage === 'function') onSyncMessage('wishlist_updated', () => {
      if (typeof renderWishlist === 'function') renderWishlist();
    });

    if (typeof onSyncMessage === 'function') onSyncMessage('reviews_updated', () => {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get('id');
      if (productId) {
        loadProduct();
      }
    });

    window.addEventListener('storage', (e) => {
      const storageKey = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.CART && CONFIG.CART.STORAGE_KEY) ? CONFIG.CART.STORAGE_KEY : 'ag_cart';
      if (e.key === storageKey) {
        updateFreeShippingHint();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
