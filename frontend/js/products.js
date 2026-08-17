/* ==================== PRODUCT DATA ==================== */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const defaultProducts = [];

let products = [];

function setProducts(newProducts) {
  products = newProducts;
}

async function fetchProducts(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice !== undefined && filters.minPrice !== '') params.set('minPrice', filters.minPrice);
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') params.set('maxPrice', filters.maxPrice);
    const queryString = params.toString();
    const url = `${CONFIG.API.BASE}/api/products${queryString ? `?${queryString}` : ''}`;
    const res = await window.fetchWithRetry(url, {}, 2, 1000);
    if (res) {
      products = await res.json();
    }
  } catch (err) {
    console.error('Error cargando productos:', err);
    products = defaultProducts;
    if (typeof renderProducts === 'function') renderProducts(getProducts());
  }
}

async function searchProducts(query, filters = {}) {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 2) {
    await applyFilters(filters);
    return;
  }
  try {
    const params = new URLSearchParams();
    params.set('q', trimmed);
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice !== undefined && filters.minPrice !== '') params.set('minPrice', filters.minPrice);
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') params.set('maxPrice', filters.maxPrice);
    const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/search?${params.toString()}`, {}, 2, 1000);
    if (res) {
      products = await res.json();
      renderProducts(getProducts());
    }
  } catch (err) {
    console.error('Error buscando productos:', err);
    showToast('', window.getFetchErrorMessage(err), 'error');
  }
}

async function applyFilters(filters = {}) {
  const category = filters.category || 'all';
  if (category === 'all' && !filters.minPrice && !filters.maxPrice) {
    await fetchProducts();
  } else {
    await fetchProducts({
      category: category === 'all' ? '' : category,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice
    });
  }
  renderProducts(getProducts());
}

function getProducts() {
  return products;
}

function getProductsByCategory(category) {
  if (category === 'all') return products;
  return products.filter(p => p.category === category);
}

function getFeaturedProducts() {
  return products.filter(p => p.featured).slice(0, 4);
}

function renderProducts(productsToRender) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (!productsToRender.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:3rem;"><h3>No se encontraron productos</h3><p>Intentá con otro filtro o búsqueda.</p></div>';
    return;
  }

  grid.innerHTML = productsToRender.map(product => {
    const imgUrl = window.getProductImageUrl(product) || '';
    const imageHtml = imgUrl
      ? window.renderProductImage(imgUrl, product.name, { className: 'product-card-img', placeholder: product.emoji || '📿' })
      : window.renderProductImage('', product.name, { className: 'product-card-img', placeholder: product.emoji || '📿' });
    const catClass = product.category ? `cat-${product.category}` : '';
    const badgeHtml = product.badge ? `<span class="product-badge">${product.badge}</span>` : '';
    const waMessage = encodeURIComponent(`Hola! Me interesa el producto: ${product.name} - ${formatARS(product.price)}`);
    const waLink = `https://wa.me/${CONFIG.CONTACT.WHATSAPP.replace(/[^\d]/g, '')}?text=${waMessage}`;
return `
    <div class="product-card reveal" data-product-id="${product.id}">
      <a href="pages/product.html?id=${product.id}" style="text-decoration:none;color:inherit;">
        <div class="product-image ${catClass}" aria-hidden="true">${imageHtml}</div>
        ${badgeHtml}
      </a>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <a href="pages/product.html?id=${product.id}" style="text-decoration:none;color:inherit;">
          <h3 class="product-name">${product.name}</h3>
        </a>
        <p class="product-description">${product.description}</p>
        <div class="product-footer">
          <span class="product-price">${formatARS(product.price)}</span>
          <a href="pages/product.html?id=${product.id}" class="product-cta">Ver producto</a>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-add-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-emoji="${escapeHtml(product.emoji||'📿')}" data-product-image="${escapeHtml(product.image||'')}" data-product-stock="${product.stock||0}" aria-label="Agregar ${escapeHtml(product.name)} al carrito"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
        <button class="btn-wishlist" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-emoji="${escapeHtml(product.emoji||'📿')}" data-product-image="${escapeHtml(product.image||'')}" aria-label="Agregar a favoritos">${window.isInWishlist(product.id) ? '❤️' : '🤍'}</button>
        <a href="${waLink}" target="_blank" class="btn-outline btn-sm" rel="noopener" title="Consultar por WhatsApp">💬</a>
      </div>
    </div>
  `;
  }).join('');

  if (window.revealObserver) {
    grid.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) {
        window.revealObserver.observe(el);
      }
    });
  }
}

function renderFeaturedProducts() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  const featured = getFeaturedProducts();
  if (!featured.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:2rem;"><p>Aún no hay productos destacados.</p></div>';
    return;
  }
  renderProducts(featured);
}

  function refreshAllProducts() {
    if (typeof fetchProducts === 'function') {
      fetchProducts().then(() => {
        if (typeof renderProducts === 'function') renderProducts(getProducts());
        if (typeof renderFeaturedProducts === 'function') renderFeaturedProducts();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await fetchProducts();
    renderProducts(getProducts());
    if (typeof renderFeaturedProducts === 'function') {
      renderFeaturedProducts();
    }

    startDataSync('products', refreshAllProducts);

  const filterButtons = document.querySelectorAll('.filter-btn');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');

  function getCurrentFilters() {
    const activeBtn = document.querySelector('.filter-btn.active');
    return {
      category: activeBtn ? activeBtn.dataset.filter : 'all',
      minPrice: minPriceInput ? minPriceInput.value : '',
      maxPrice: maxPriceInput ? maxPriceInput.value : ''
    };
  }

  async function refreshProducts() {
    const filters = getCurrentFilters();
    const query = searchInput ? searchInput.value : '';
    if (query) {
      await searchProducts(query, filters);
    } else {
      await applyFilters(filters);
    }
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      refreshProducts();
    });
  });

  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => {
      refreshProducts();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        refreshProducts();
      }
    });
  }

  [minPriceInput, maxPriceInput].forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      clearTimeout(input._debounce);
      input._debounce = setTimeout(refreshProducts, 400);
    });
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      filterButtons.forEach(b => b.classList.remove('active'));
      const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
      if (allBtn) allBtn.classList.add('active');
      refreshProducts();
    });
  }

  document.getElementById('productsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add-cart');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
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

  document.getElementById('productsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-wishlist');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
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
});

// Exportar para Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getProducts, getProductsByCategory, getFeaturedProducts, renderProducts, fetchProducts, setProducts, defaultProducts };
}