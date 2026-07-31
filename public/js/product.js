/* ==================== PRODUCT PAGE ==================== */

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

let currentProduct = null;

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get('id'));
  if (!productId) {
    document.getElementById('productContainer').innerHTML = '<div class="empty-state">Producto no encontrado</div>';
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/products/${productId}`);
    const product = await res.json();
    if (!res.ok) throw new Error(product.error || 'Error cargando producto');

    currentProduct = product;
    document.getElementById('breadcrumbProduct').textContent = product.name || 'Producto';
    document.title = `${product.name} | IARA`;

    renderProduct(product);
    await loadRelatedProducts(product);
    await loadReviews(product);
    injectStructuredData(product);
  } catch (err) {
    document.getElementById('productContainer').innerHTML = `<div class="empty-state">Error al cargar el producto: ${escapeHtml(err.message)}</div>`;
  }
}

function renderProduct(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const primaryImg = images.find(img => img.is_primary) || images[0];
  const fallbackImg = product.image || '';
  const mainImg = primaryImg ? primaryImg.url : fallbackImg;
  const mainAlt = primaryImg ? (primaryImg.alt || product.name) : product.name;

  const reviewsCount = Number(product.reviews_count || 0);
  const avgRating = Number(product.avg_rating || 0);
  const ratingHtml = reviewsCount > 0 ? `<div style="font-size:0.85rem;color:#f59e0b;margin-top:0.4rem;">${'⭐'.repeat(Math.round(avgRating))} <span style="color:var(--text-muted);font-size:0.8rem;">(${reviewsCount} reseñas)</span></div>` : '';

  const stock = Number(product.stock ?? 0);
  const outOfStock = stock <= 0;
  const stockHtml = outOfStock ? '<span class="product-badge badge-out">Sin stock</span>' : `<span class="product-badge">Stock: ${stock}</span>`;

  const galleryHtml = images.length > 1 ? `
    <div class="product-gallery-thumbs" style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
      ${images.map(img => `
        <button class="gallery-thumb" data-src="${escapeHtml(img.url)}" style="width:64px;height:64px;border-radius:8px;border:2px solid transparent;overflow:hidden;background:#fff;cursor:pointer;padding:0;" aria-label="Ver imagen">
          <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || product.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
        </button>
      `).join('')}
    </div>
  ` : '';

  const productData = JSON.stringify({ id: product.id, name: product.name, price: product.price, emoji: product.emoji || '📿', image: mainImg || '', stock: stock, unit: 'u', qty: 1 });

  document.getElementById('productContainer').innerHTML = `
    <div class="product" style="display:grid;grid-template-columns:1fr;gap:1.5rem;background:#fff;padding:1.5rem;border-radius:var(--radius-md);box-shadow:var(--shadow-sm);border:1px solid #f4d0da;">
      <div style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #fde8ef, #f8d5e4);border-radius:var(--radius-md);padding:1rem;border:1px solid #f4c8d4;">
        <img src="${escapeHtml(mainImg)}" alt="${escapeHtml(mainAlt)}" id="mainProductImage" style="max-width:100%;max-height:320px;object-fit:contain;" loading="lazy" />
      </div>
      <div>
        <span style="display:inline-block;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;">${escapeHtml(product.category || '')}</span>
        <h1 style="font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:700;color:var(--text-dark);margin-bottom:0.75rem;line-height:1.2;">${escapeHtml(product.name)}</h1>
        ${stockHtml}
        ${ratingHtml}
        <p style="color:var(--text-mid);line-height:1.6;margin:1rem 0;font-size:0.95rem;">${escapeHtml(product.description || '')}</p>
        <p style="font-family:'Playfair Display',serif;font-weight:700;font-size:1.5rem;color:var(--rose-dark);margin-top:0.5rem;margin-bottom:1.5rem;" id="productPrice">${formatARS(product.price)}</p>
        <div id="productActions" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;">
          ${!outOfStock ? `
            <div style="display:flex;align-items:center;gap:0.5rem;border:1px solid var(--pink-200);border-radius:8px;padding:0.5rem;">
              <button id="qtyMinus" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--pink-200);background:#fff;cursor:pointer;font-weight:700;">-</button>
              <span id="qtyValue" style="min-width:24px;text-align:center;font-weight:600;">1</span>
              <button id="qtyPlus" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--pink-200);background:#fff;cursor:pointer;font-weight:700;">+</button>
            </div>
            <button class="btn-primary" data-action="add-to-cart" data-product='${productData}'>Agregar al carrito</button>
          ` : '<button class="btn-primary" disabled style="opacity:.5;cursor:not-allowed;">Sin stock</button>'}
          <button class="btn-outline" onclick="location.href='../index.html'">Ver catálogo</button>
        </div>
      </div>
      ${galleryHtml}
    </div>
    <div id="relatedContainer"></div>
    <div id="reviewsContainer"></div>
    <div id="reviewFormContainer"></div>
  `;

  initQuantitySelector(product);
  initProductActions();
  initGallery();
}

function initQuantitySelector(product) {
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  const valueEl = document.getElementById('qtyValue');
  if (!minus || !plus || !valueEl) return;

  const stock = Math.max(1, Number(product.stock ?? 0));
  let qty = 1;

  minus.addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    valueEl.textContent = qty;
    updateProductDataQty(qty);
  });

  plus.addEventListener('click', () => {
    qty = Math.min(stock, qty + 1);
    valueEl.textContent = qty;
    updateProductDataQty(qty);
  });
}

function updateProductDataQty(qty) {
  const btn = document.querySelector('[data-product]');
  if (!btn || !currentProduct) return;
  try {
    const data = JSON.parse(btn.dataset.product);
    data.qty = qty;
    btn.dataset.product = JSON.stringify(data);
  } catch {
  // intentional: swallow errors silently
}
}

function initProductActions() {
  document.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        const data = JSON.parse(btn.dataset.product);
        addToCart(data);
      } catch {
        addToCart({ ...currentProduct, qty: 1 });
      }
    });
  });
}

function initGallery() {
  document.querySelectorAll('.gallery-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const main = document.getElementById('mainProductImage');
      if (main) main.src = btn.dataset.src;
      document.querySelectorAll('.gallery-thumb').forEach(t => t.style.borderColor = 'transparent');
      btn.style.borderColor = 'var(--rose-dark)';
    });
  });
}

async function loadRelatedProducts(product) {
  const container = document.getElementById('relatedContainer');
  if (!container) return;

  try {
    const res = await fetch('${CONFIG.API_BASE_URL}/api/products');
    const all = await res.json();
    const related = (Array.isArray(all) ? all : []).filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    if (!related.length) return;

    container.innerHTML = `
      <div style="margin-top:2.5rem;">
        <h2 style="font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--text-dark);margin-bottom:1rem;">También te puede gustar</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;">
          ${related.map(p => {
            const pimages = Array.isArray(p.images) ? p.images : [];
            const pimg = pimages.find(img => img.is_primary) || pimages[0];
            const pfallback = p.image || '';
            const pimgSrc = pimg ? pimg.url : pfallback;
            return `
              <a href="product.html?id=${p.id}" style="text-decoration:none;color:inherit;background:#fff;padding:1rem;border-radius:var(--radius-md);border:1px solid #f4d0da;display:flex;flex-direction:column;gap:0.5rem;">
                <div style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fde8ef,#f8d5e4);border-radius:8px;padding:1rem;border:1px solid #f4c8d4;">
                  ${pimgSrc ? `<img src="${escapeHtml(pimgSrc)}" alt="${escapeHtml(p.name)}" style="max-width:100%;max-height:120px;object-fit:contain;" loading="lazy" />` : `<span style="font-size:2rem;">${p.emoji || '📿'}</span>`}
                </div>
                <div>
                  <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(p.category || '')}</div>
                  <div style="font-weight:600;color:var(--text-dark);font-size:0.95rem;">${escapeHtml(p.name)}</div>
                  <div style="font-weight:700;color:var(--rose-dark);font-size:1rem;">${formatARS(p.price)}</div>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    // Error loading related products - silently fail
  }
}

async function loadReviews(product) {
  const container = document.getElementById('reviewsContainer');
  const formContainer = document.getElementById('reviewFormContainer');
  if (!container) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/products/${product.id}/reviews`);
    const reviews = await res.json();
    const count = Array.isArray(reviews) ? reviews.length : 0;
    const avg = count ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count) : 0;

    container.innerHTML = `
      <div style="margin-top:2.5rem;">
        <h2 style="font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--text-dark);margin-bottom:0.5rem;">Reseñas</h2>
        <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem;">${avg ? `${'⭐'.repeat(Math.round(avg))} ${avg.toFixed(1)}` : 'Sin reseñas aún'} · ${count} reseña${count === 1 ? '' : 's'}</div>
        <div id="reviewsList" style="display:grid;gap:0.75rem;">
          ${renderReviewsList(reviews)}
        </div>
      </div>
    `;

    if (formContainer) {
      formContainer.innerHTML = `
        <div style="margin-top:1.5rem;background:#fff;padding:1.25rem;border-radius:var(--radius-md);border:1px solid #f4d0da;">
          <h3 style="font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--text-dark);margin-bottom:0.75rem;">Dejá tu reseña</h3>
          <form id="reviewForm" style="display:grid;gap:0.75rem;">
            <input type="text" id="reviewName" placeholder="Tu nombre" required style="padding:0.6rem;border:1px solid var(--pink-200);border-radius:8px;" />
            <select id="reviewRating" required style="padding:0.6rem;border:1px solid var(--pink-200);border-radius:8px;">
              <option value="">Calificación</option>
              <option value="5">5 - Excelente</option>
              <option value="4">4 - Muy bueno</option>
              <option value="3">3 - Bueno</option>
              <option value="2">2 - Regular</option>
              <option value="1">1 - Malo</option>
            </select>
            <textarea id="reviewComment" rows="3" placeholder="Contanos tu experiencia..." style="padding:0.6rem;border:1px solid var(--pink-200);border-radius:8px;"></textarea>
            <button type="submit" class="btn-primary">Enviar reseña</button>
          </form>
        </div>
      `;

      document.getElementById('reviewForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reviewName').value.trim();
        const rating = Number(document.getElementById('reviewRating').value);
        const comment = document.getElementById('reviewComment').value.trim();
        if (!name || !rating) { showToast('', 'Completá tu nombre y calificación', 'error'); return; }

        const tokenRes = await fetch('${CONFIG.API_BASE_URL}/api/csrf-token');
        const tokenData = await tokenRes.json();

        const res = await fetch(`${CONFIG.API_BASE_URL}/api/products/${product.id}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tokenData.csrfToken },
          body: JSON.stringify({ customer_name: name, rating, comment })
        });
        const data = await res.json();
        if (!res.ok) { showToast('', data.error || 'Error enviando reseña', 'error'); return; }
        showToast('', 'Reseña enviada. Gracias!', 'success');
        document.getElementById('reviewForm').reset();
        await loadReviews(product);
      });
    }
  } catch (err) {
    // Error loading reviews - silently fail
  }
}

function renderReviewsList(reviews) {
  if (!Array.isArray(reviews) || !reviews.length) return '<p style="color:var(--text-muted)">Aún no hay reseñas para este producto.</p>';
  return reviews.map(r => `
    <div style="background:#fff;padding:1rem;border-radius:8px;border:1px solid #f4d0da;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <strong style="color:var(--text-dark)">${escapeHtml(r.customer_name || 'Anónimo')}</strong>
        <span style="color:#f59e0b;font-size:0.85rem;">${'⭐'.repeat(r.rating || 0)}</span>
      </div>
      <div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.25rem;">${new Date(r.created_at).toLocaleDateString('es-AR')}</div>
      ${r.comment ? `<p style="margin-top:0.5rem;color:var(--text-mid);line-height:1.5;">${escapeHtml(r.comment)}</p>` : ''}
    </div>
  `).join('');
}

function injectStructuredData(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const primaryImg = images.find(img => img.is_primary) || images[0];
  const fallbackImg = product.image || '';
  const imgUrl = primaryImg ? primaryImg.url : fallbackImg;
  const data = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: imgUrl || undefined,
    offers: {
      '@type': 'Offer',
      price: String(Number(product.price || 0)),
      priceCurrency: 'ARS',
      availability: Number(product.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(data);
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  loadProduct();
  updateCartBadge();
});
