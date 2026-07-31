/* ==================== PRODUCT DATA ==================== */

/*
 * NOTA: Los productos se cargan desde la API (${CONFIG.API_BASE_URL}/api/products).
 * Los productos fallback (defaultProducts) solo se usan como respaldo
 * si la API falla. Mantenelo sincronizado con backend/src/lib/db.js productSeeds.
 */

const defaultProducts = [
  { id: 1, name: 'Pulsera Minimalista Rosa', category: 'pulseras', price: 450, description: 'Diseño minimalista con cuentas de cerámica en tonos rosa pastel', emoji: '📿', image: '' },
  { id: 2, name: 'Pulsera Menta Orgánica', category: 'pulseras', price: 520, description: 'Pulsera tejida con materiales ecológicos en tonos verdes', emoji: '📿', image: '' },
  { id: 3, name: 'Llavero Artesanal', category: 'accesorios', price: 250, description: 'Llavero tejido a mano con detalle floral', emoji: '💎', image: '' },
  { id: 4, name: 'Souvenir Gualeguay', category: 'souvenirs', price: 380, description: 'Imán decorativo con representación local', emoji: '🎁', image: '' },
  { id: 5, name: 'Pulsera Bohemia Multi', category: 'pulseras', price: 590, description: 'Pulsera con múltiples hilos y cuentas en tonos variados', emoji: '📿', image: '' },
  { id: 6, name: 'Collar Artesanal Corto', category: 'accesorios', price: 650, description: 'Collar corto con colgante hecho a mano', emoji: '💎', image: '' },
  { id: 7, name: 'Pack 3 Pulseras Surtidas', category: 'pulseras', price: 1200, description: 'Set de 3 pulseras con diferentes diseños', emoji: '📿', image: '' },
  { id: 8, name: 'Brazalete Tejido Premium', category: 'pulseras', price: 890, description: 'Brazalete ancho tejido con técnica tradicional', emoji: '📿', image: '' },
  { id: 9, name: 'Souvenir Taza Personalizada', category: 'souvenirs', price: 320, description: 'Taza de cerámica con diseño exclusivo de Gualeguay', emoji: '🎁', image: '' },
  { id: 10, name: 'Anillo Cerámica', category: 'accesorios', price: 280, description: 'Anillo ajustable hecho de cerámica cocida artesanalmente', emoji: '💎', image: '' },
  { id: 11, name: 'Pulsera Amistad Dual', category: 'pulseras', price: 480, description: 'Pulsera de amistad para compartir en tonos complementarios', emoji: '📿', image: '' },
  { id: 12, name: 'Marcapáginas Decorativo', category: 'souvenirs', price: 150, description: 'Marcapáginas hecho a mano con técnica mixta', emoji: '🎁', image: '' },
  { id: 13, name: 'Pulsera Perlas Naturales', category: 'pulseras', price: 620, description: 'Pulsera con perlas naturales y cierre ajustable', emoji: '📿', image: '' },
  { id: 14, name: 'Dije Macramé', category: 'accesorios', price: 350, description: 'Dije tejido en macramé con hilo encerado', emoji: '💎', image: '' },
  { id: 15, name: 'Imán Cerámica Flor', category: 'souvenirs', price: 180, description: 'Imán de cerámica con detalle flor pintado a mano', emoji: '🎁', image: '' },
  { id: 16, name: 'Pulsera Trenzada Cuero', category: 'pulseras', price: 750, description: 'Pulsera de cuero trenzado con cierre magnético', emoji: '📿', image: '' },
  { id: 17, name: 'Pack Llaveros x5', category: 'accesorios', price: 1100, description: 'Set de 5 llaveros con diseños variados', emoji: '💎', image: '' },
  { id: 18, name: 'Souvenir Imán Ciudad', category: 'souvenirs', price: 200, description: 'Imán con ilustración de la ciudad', emoji: '🎁', image: '' },
  { id: 19, name: 'Collar Largo Boho', category: 'accesorios', price: 950, description: 'Collar largo con cuentas y dijes étnicos', emoji: '💎', image: '' },
  { id: 20, name: 'Pulsera Ajustable Nudos', category: 'pulseras', price: 400, description: 'Pulsera de nudos ajustable estilo surfer', emoji: '📿', image: '' },
  { id: 21, name: 'Kit Regalo Personalizado', category: 'souvenirs', price: 1500, description: 'Set de regalo con productos a elección', emoji: '🎁', image: '' },
  { id: 22, name: 'Anillo Anatómico Corazón', category: 'accesorios', price: 380, description: 'Anillo con diseño de corazón anatómico', emoji: '💎', image: '' },
  { id: 23, name: 'Pulsera Multicolor Caramelo', category: 'pulseras', price: 580, description: 'Pulsera con hilos de colores vibrantes estilo caramelo', emoji: '📿', image: '' },
  { id: 24, name: 'Dije Hoja Minima', category: 'accesorios', price: 220, description: 'Dije de hojas con baño en oro', emoji: '💎', image: '' },
  { id: 25, name: 'Souvenir Lapiz Decorado', category: 'souvenirs', price: 180, description: 'Lapiz con detalles pintados a mano', emoji: '🎁', image: '' },
  { id: 26, name: 'Pack Pulseras x3', category: 'pulseras', price: 1300, description: 'Set de 3 pulseras combinadas en tonos pastel', emoji: '📿', image: '' },
  { id: 27, name: 'Collar Cadena Perla', category: 'accesorios', price: 890, description: 'Collar cadena con dije de perla artesanal', emoji: '💎', image: '' },
  { id: 28, name: 'Imán Corazón Tallado', category: 'souvenirs', price: 160, description: 'Imán en forma de corazón con grabado', emoji: '🎁', image: '' },
  { id: 29, name: 'Pulsera Hilo Ajustable', category: 'pulseras', price: 340, description: 'Pulsera de hilo encerado ajustable', emoji: '📿', image: '' },
  { id: 30, name: 'Llavero Inicial', category: 'accesorios', price: 260, description: 'Llavero personalizado con inicial de ceramica', emoji: '💎', image: '' },
  { id: 31, name: 'Souvenir Sobre Madera', category: 'souvenirs', price: 430, description: 'Souvenir en madera grabada con motivo local', emoji: '🎁', image: '' },
  { id: 32, name: 'Pulsera Destellos', category: 'pulseras', price: 530, description: 'Pulsera con cuentas brillantes para ocasiones especiales', emoji: '📿', image: '' },
  { id: 33, name: 'Collar Turquesa Natural', category: 'accesorios', price: 720, description: 'Collar corto con piedra turquesa natural', emoji: '💎', image: '' },
  { id: 34, name: 'Pulsera Nudo Celta', category: 'pulseras', price: 470, description: 'Pulsera con nudo celta en hilo encerado', emoji: '📿', image: '' },
  { id: 35, name: 'Imán Madera Corazón', category: 'souvenirs', price: 190, description: 'Imán de madera con forma de corazón', emoji: '🎁', image: '' },
  { id: 36, name: 'Pack Dijes x4', category: 'accesorios', price: 980, description: 'Set de 4 dijes combinados para personalizar', emoji: '💎', image: '' },
  { id: 37, name: 'Pulsera Rosa Fuerte', category: 'pulseras', price: 510, description: 'Pulsera en tono rosa intenso con cierre ajustable', emoji: '📿', image: '' },
  { id: 38, name: 'Souvenir Llavero Ciudad', category: 'souvenirs', price: 240, description: 'Llavero con grabado del nombre de la ciudad', emoji: '🎁', image: '' },
  { id: 39, name: 'Aros Cadena Fina', category: 'accesorios', price: 630, description: 'Aros colgantes con cadena fina artesanal', emoji: '💎', image: '' },
  { id: 40, name: 'Pulserada Mix 5u', category: 'pulseras', price: 1450, description: 'Pack de 5 pulseras surtidas en colores pastel', emoji: '📿', image: '' },
  { id: 41, name: 'Cuaderno Decorado', category: 'accesorios', price: 170, description: 'Cuaderno tapa dura con ilustración artesanal', emoji: '💎', image: '' }
];

let frontProducts = (typeof global !== 'undefined' && global.products) ? global.products : defaultProducts;

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setProducts(newProducts) {
  frontProducts = newProducts;
}

async function fetchProducts() {
  try {
    const grid = document.getElementById('productsGrid');
    if (grid) {
      grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Cargando productos...</p>';
    }
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/products`);
    if (res.ok) {
      frontProducts = await res.json();
    }
  } catch {
    frontProducts = defaultProducts;
  }
}

function getProducts() {
  return frontProducts;
}

function getProductsByCategory(category) {
  if (category === 'all') return frontProducts;
  return frontProducts.filter(p => p.category === category);
}

function refreshCartButtons() {
  document.querySelectorAll('.btn-icon-circle.btn-cart').forEach(btn => {
    const badge = btn.querySelector('.cart-badge');
    if (!badge) return;
    const product = JSON.parse(btn.dataset.product);
    const cartItem = cart.find(item => item.id === product.id);
    if (cartItem && cartItem.qty > 0) {
      badge.textContent = cartItem.qty;
    } else {
      badge.textContent = '+';
    }
  });
}

function renderProducts(productsToRender) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = productsToRender.map(product => {
    const images = Array.isArray(product.images) ? product.images : [];
    const primaryImg = images.find(img => img.is_primary) || images[0];
    const fallbackImg = product.image || '';
    const imgSrc = primaryImg ? primaryImg.url : fallbackImg;
    const imageHtml = imgSrc
      ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
      : product.emoji || '📿';
    const catClass = product.category ? `cat-${escapeHtml(product.category)}` : '';
    const badgeHtml = product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : '';
    const waMessage = encodeURIComponent(`Hola! Me interesa el producto: ${product.name} - ${formatARS(product.price)}`);
    const waLink = `https://wa.me/${CONFIG.CONTACT.WHATSAPP.replace(/[^\d]/g, '')}?text=${waMessage}`;
    const stock = Number(product.stock ?? 0);
    const outOfStock = stock <= 0;
    const reviewsCount = Number(product.reviews_count || 0);
    const avgRating = Number(product.avg_rating || 0);
    const ratingHtml = reviewsCount > 0 ? `<div style="font-size:0.8rem;color:#f59e0b;margin-top:0.25rem;">${'⭐'.repeat(Math.round(avgRating))} <span style="color:var(--text-muted);font-size:0.75rem;">(${reviewsCount})</span></div>` : '';
    const productData = JSON.stringify({ id: product.id, name: product.name, price: product.price, emoji: product.emoji || '📿', image: imgSrc || '', stock: stock, unit: 'u', qty: 1 });
    return `
      <div class="product-card reveal" data-product-id="${product.id}">
        <div class="product-image ${catClass}" aria-hidden="true">${imageHtml}</div>
        ${badgeHtml}
        ${outOfStock ? '<span class="product-badge badge-out">Sin stock</span>' : ''}
        <div class="product-info">
          <span class="product-category">${escapeHtml(product.category)}</span>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          <p class="product-description">${escapeHtml(product.description)}</p>
          ${ratingHtml}
          <div class="product-footer">
            <span class="product-price">${formatARS(product.price)}</span>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <button class="btn-icon-circle btn-cart" data-action="add-to-cart" data-product='${productData}' ${outOfStock ? 'disabled' : ''} aria-label="Agregar al carrito">
                <span class="cart-icon" aria-hidden="true">🛒</span>
                <span class="cart-badge" aria-hidden="true">+</span>
              </button>
              <a href="${waLink}" target="_blank" class="btn-icon-circle" rel="noopener" title="Consultar por WhatsApp" aria-label="Consultar por WhatsApp">💬</a>
              <button class="btn-icon-circle" data-action="open-reviews" data-product-id="${product.id}" data-product-name="${product.name}" title="Ver reseñas" aria-label="Ver reseñas">⭐</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const product = JSON.parse(btn.dataset.product);
      addToCart(product);
      refreshCartButtons();
      btn.classList.remove('added');
      void btn.offsetWidth;
      btn.classList.add('added');
      btn.addEventListener('animationend', function restore() {
        btn.classList.remove('added');
      }, { once: true });
    });
  });

  grid.querySelectorAll('[data-action="open-reviews"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openReviewsModal(Number(btn.dataset.productId), btn.dataset.productName);
    });
  });

  refreshCartButtons();

  if (window.revealObserver) {
    grid.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) {
        window.revealObserver.observe(el);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchProducts();
  renderProducts(getProducts());

  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const category = e.target.dataset.filter;
      renderProducts(getProductsByCategory(category));
    });
  });
});

let currentReviewProductId = null;

async function openReviewsModal(productId, productName) {
  currentReviewProductId = productId;
  const modalOverlay = document.getElementById('reviewsModalOverlay');
  const modalTitle = document.getElementById('reviewsModalTitle');
  const list = document.getElementById('reviewsList');
  if (!modalOverlay || !list) return;
  modalTitle.textContent = `Reseñas - ${productName || `Producto #${productId}`}`;
  list.innerHTML = '<p style="color:var(--text-muted)">Cargando reseñas...</p>';
  modalOverlay.classList.add('active');
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/products/${productId}/reviews`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error cargando reseñas');
    renderReviewsList(data);
  } catch (err) {
    list.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
  }
}

function renderReviewsList(reviews) {
  const list = document.getElementById('reviewsList');
  if (!list) return;
  if (!reviews || reviews.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted)">Todavía no hay reseñas. ¡Sé el primero!</p>';
    return;
  }
  const sorted = [...reviews].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  list.innerHTML = sorted.map(r => `
    <div style="padding:0.75rem 0;border-bottom:1px solid var(--warm-gray);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
        <strong>${r.customer_name || 'Anónimo'}</strong>
        <span style="color:#f59e0b;font-size:0.85rem;">${'⭐'.repeat(r.rating || 0)}</span>
      </div>
      <p style="color:var(--text-mid);margin-top:0.3rem;font-size:0.9rem;">${r.comment || ''}</p>
    </div>
  `).join('');
}

function closeReviewsModal() {
  const modalOverlay = document.getElementById('reviewsModalOverlay');
  if (modalOverlay) modalOverlay.classList.remove('active');
  currentReviewProductId = null;
}

function initStarRating() {
  const container = document.getElementById('starRating');
  if (!container) return;
  const hidden = document.getElementById('reviewRating');
  const stars = container.querySelectorAll('.star');

  function setRating(value) {
    stars.forEach(star => {
      const starVal = Number(star.dataset.value);
      star.classList.toggle('active', starVal <= value);
      star.setAttribute('aria-checked', starVal === value ? 'true' : 'false');
    });
    if (hidden) hidden.value = value;
  }

  container.addEventListener('click', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    setRating(Number(star.dataset.value));
  });

  container.addEventListener('mouseover', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    const value = Number(star.dataset.value);
    stars.forEach(s => {
      const starVal = Number(s.dataset.value);
      s.classList.toggle('active', starVal <= value);
    });
  });

  container.addEventListener('mouseleave', () => {
    const current = hidden ? Number(hidden.value) : 5;
    setRating(current);
  });

  stars.forEach(star => {
    star.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setRating(Number(star.dataset.value));
      }
    });
  });
}

document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentReviewProductId) return;
  const name = document.getElementById('reviewName').value.trim();
  const rating = Number(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();
  if (!name || !rating) {
    showToast('Nombre y calificación son obligatorios', 'error');
    return;
  }
  try {
    const csrfRes = await fetch('${CONFIG.API_BASE_URL}/api/csrf-token');
    const csrfData = await csrfRes.json().catch(() => ({}));
    const headers = { 'Content-Type': 'application/json', ...(csrfData.csrfToken ? { 'X-CSRF-Token': csrfData.csrfToken } : {}) };
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/products/${currentReviewProductId}/reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ customer_name: name, rating, comment })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar reseña');
    showToast('Gracias por tu reseña', 'success');
    document.getElementById('reviewForm').reset();
    const hiddenRating = document.getElementById('reviewRating');
    if (hiddenRating) hiddenRating.value = '5';
    const stars = document.querySelectorAll('#starRating .star');
    stars.forEach(star => {
      const starVal = Number(star.dataset.value);
      star.classList.toggle('active', starVal === 5);
      star.setAttribute('aria-checked', starVal === 5 ? 'true' : 'false');
    });
    await openReviewsModal(currentReviewProductId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('reviewsModalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'reviewsModalOverlay') closeReviewsModal();
});

initStarRating();

// Exportar para Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getProducts, getProductsByCategory, renderProducts, fetchProducts, setProducts, openReviewsModal };
}