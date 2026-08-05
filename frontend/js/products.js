/* ==================== PRODUCT DATA ==================== */

const defaultProducts = [
  {
    id: 1,
    name: 'Pulsera Minimalista Rosa',
    category: 'pulseras',
    price: 450,
    description: 'Diseño minimalista con cuentas de cerámica en tonos rosa pastel',
    emoji: '📿',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 2,
    name: 'Pulsera Menta Orgánica',
    category: 'pulseras',
    price: 520,
    description: 'Pulsera tejida con materiales ecológicos en tonos verdes',
    emoji: '📿',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 3,
    name: 'Llavero Artesanal',
    category: 'accesorios',
    price: 250,
    description: 'Llavero tejido a mano con detalle floral',
    emoji: '💎',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 4,
    name: 'Souvenir Gualeguay',
    category: 'souvenirs',
    price: 380,
    description: 'Imán decorativo con representación local',
    emoji: '🎁',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 5,
    name: 'Pulsera Bohemia Multi',
    category: 'pulseras',
    price: 590,
    description: 'Pulsera con múltiples hilos y cuentas en tonos variados',
    emoji: '📿',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 6,
    name: 'Collar Artesanal Corto',
    category: 'accesorios',
    price: 650,
    description: 'Collar corto con colgante hecho a mano',
    emoji: '💎',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 7,
    name: 'Pack 3 Pulseras Surtidas',
    category: 'pulseras',
    price: 1200,
    description: 'Set de 3 pulseras con diferentes diseños',
    emoji: '📿',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 8,
    name: 'Brazalete Tejido Premium',
    category: 'pulseras',
    price: 890,
    description: 'Brazalete ancho tejido con técnica tradicional',
    emoji: '📿',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 9,
    name: 'Souvenir Taza Personalizada',
    category: 'souvenirs',
    price: 320,
    description: 'Taza de cerámica con diseño exclusivo de Gualeguay',
    emoji: '🎁',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 10,
    name: 'Anillo Cerámica',
    category: 'accesorios',
    price: 280,
    description: 'Anillo ajustable hecho de cerámica cocida artesanalmente',
    emoji: '💎',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 11,
    name: 'Pulsera Amistad Dual',
    category: 'pulseras',
    price: 480,
    description: 'Pulsera de amistad para compartir en tonos complementarios',
    emoji: '📿',
    image: 'assets/placeholder-product.svg'
  },
  {
    id: 12,
    name: 'Marcapáginas Decorativo',
    category: 'souvenirs',
    price: 150,
    description: 'Marcapáginas hecho a mano con técnica mixta',
    emoji: '🎁',
    image: 'assets/placeholder-product.svg'
  }
];

let products = (typeof global !== 'undefined' && global.products) ? global.products : defaultProducts.map(p => ({ ...p, stock: p.stock ?? 10 }));

function setProducts(newProducts) {
  products = newProducts;
}

async function fetchProducts() {
  try {
    const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products`, {}, 2, 1000);
    if (res) {
      products = await res.json();
    }
  } catch {
    products = defaultProducts;
  }
}

async function searchProducts(query) {
  if (!query || query.trim().length < 2) {
    await fetchProducts();
    renderProducts(getProducts());
    return;
  }
  try {
    const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/search?q=${encodeURIComponent(query.trim())}`, {}, 2, 1000);
    if (res) {
      products = await res.json();
      renderProducts(getProducts());
    }
  } catch (err) {
    console.error('Error buscando productos:', err);
    showToast('', window.getFetchErrorMessage(err), 'error');
  }
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
    const imageHtml = product.image
      ? window.renderProductImage(product.image, product.name, { className: 'product-card-img', placeholder: product.emoji || '📿' })
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
          <div class="product-info">
            <span class="product-category">${product.category}</span>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-footer">
              <span class="product-price">${formatARS(product.price)}</span>
            </div>
          </div>
        </a>
        <div style="display:flex;gap:0.5rem;padding:0 0.5rem 0.5rem;">
          <button class="btn-add-cart" onclick="addToCart(${JSON.stringify({id: product.id, name: product.name, price: product.price, emoji: product.emoji||'📿', image: product.image||'', stock: product.stock||0, unit: 'u', qty: 1})}); event.stopPropagation(); event.preventDefault();" aria-label="Agregar ${product.name} al carrito"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
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

document.addEventListener('DOMContentLoaded', async () => {
  await fetchProducts();
  renderProducts(getProducts());
  if (typeof renderFeaturedProducts === 'function') {
    renderFeaturedProducts();
  }

  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const category = e.target.dataset.filter;
      renderProducts(getProductsByCategory(category));
    });
  });

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => {
      searchProducts(searchInput.value);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchProducts(searchInput.value);
      }
    });
  }
});

// Exportar para Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getProducts, getProductsByCategory, getFeaturedProducts, renderProducts, fetchProducts, setProducts };
}