/* global Chart */
/* eslint-disable no-unused-vars */
const API_BASE = '/';
const DOMPurify = window.DOMPurify || { sanitize: (html) => String(html).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])) };
function setHTML(el, html) { if (!el) return; el.innerHTML = DOMPurify.sanitize(html); }

let authToken = localStorage.getItem('ag_admin_jwt') || '';
let userRole = localStorage.getItem('ag_admin_role') || 'admin';
let currentSection = 'products';
let products = [];
let orders = [];
let filteredOrders = [];
let ordersMeta = {};
let currentOrderPage = 1;
const ORDERS_PER_PAGE = 20;
let testimonials = [];
let siteTexts = {};
let reviews = [];
let productMeta = {};
let editingId = null;
let currentOrderId = null;

function getApiUrl(path) {
  const base = (CONFIG.API_BASE_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function checkServerHealth() {
  const btn = document.getElementById('loginBtn');
  const dot = document.getElementById('serverDot');
  const text = document.getElementById('serverText');
  try {
    btn.textContent = 'Verificando...';
    btn.disabled = true;
    const res = await fetch(getApiUrl('/api/health'), { method: 'GET', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Servidor respondió con estado ${res.status}`);
    if (dot) { dot.classList.add('connected'); dot.classList.remove('error'); }
    if (text) text.textContent = 'Servidor conectado';
  } catch (err) {
    if (dot) { dot.classList.add('error'); dot.classList.remove('connected'); }
    if (text) text.textContent = 'Sin conexión';
  } finally {
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.protocol === 'file:') {
    document.getElementById('loginUser').disabled = true;
    document.getElementById('loginPass').disabled = true;
    document.getElementById('passwordToggle').disabled = true;
    document.getElementById('loginBtn').disabled = true;
    const dot = document.getElementById('serverDot');
    const text = document.getElementById('serverText');
    if (dot) { dot.classList.add('error'); dot.classList.remove('connected'); }
    if (text) text.textContent = 'Abrí desde el servidor';
  } else {
    checkServerHealth();
  }
});

const passwordToggle = document.getElementById('passwordToggle');
const loginPass = document.getElementById('loginPass');
if (passwordToggle && loginPass) {
  passwordToggle.addEventListener('click', () => {
    const isPassword = loginPass.type === 'password';
    loginPass.type = isPassword ? 'text' : 'password';
    passwordToggle.classList.toggle('showing', isPassword);
    passwordToggle.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!username || !password) {
    showToast('Ingresá usuario y contraseña', 'error');
    return;
  }
  const btn = document.getElementById('loginBtn');
  try {
    btn.textContent = 'Ingresando...';
    btn.disabled = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    authToken = data.token;
    localStorage.setItem('ag_admin_jwt', authToken);
    document.getElementById('loginOverlay').classList.add('hidden');
    showToast(`Bienvenida, ${data.user}`, 'success');
    navigateTo('products');
  } catch (err) {
    console.error('Login error:', err);
    if (err.name === 'AbortError') {
      showToast('El servidor tardó demasiado. Recargá la página.', 'error');
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
}

function doLogout() {
  authToken = '';
  localStorage.removeItem('ag_admin_jwt');
  document.getElementById('loginOverlay').classList.remove('hidden');
  showToast('Sesión cerrada', 'default');
}

async function adminFetch(url, opts = {}) {
  if (!authToken) throw new Error('No autorizado');
  const headers = { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    authToken = '';
    localStorage.removeItem('ag_admin_jwt');
    document.getElementById('loginOverlay').classList.remove('hidden');
    throw new Error('Sesión expirada');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res;
}

function showToast(message, type = 'default') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function navigateTo(section) {
   currentSection = section;
   document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
   document.querySelector(`.sidebar-nav a[data-section="${section}"]`)?.classList.add('active');
   document.getElementById('productsSection').style.display = section === 'products' ? 'block' : 'none';
   document.getElementById('ordersSection').style.display = section === 'orders' ? 'block' : 'none';
   document.getElementById('testimonialsSection').style.display = section === 'testimonials' ? 'block' : 'none';
   document.getElementById('textsSection').style.display = section === 'texts' ? 'block' : 'none';
   document.getElementById('reviewsSection').style.display = section === 'reviews' ? 'block' : 'none';
   document.getElementById('reportsSection').style.display = section === 'reports' ? 'block' : 'none';
   document.getElementById('categoriesSection').style.display = section === 'categories' ? 'block' : 'none';
   document.getElementById('subscribersSection').style.display = section === 'subscribers' ? 'block' : 'none';
   document.getElementById('paymentsSection').style.display = section === 'payments' ? 'block' : 'none';
   document.getElementById('settingsSection').style.display = section === 'settings' ? 'block' : 'none';
   const titles = {
     products: ['Productos', 'Gestioná productos, fotos y precios', '+ Nuevo Producto'],
     orders: ['Pedidos', 'Gestioná pedidos y pagos', ''],
     testimonials: ['Testimonios', 'Gestioná testimonios de clientes', '+ Nuevo Testimonio'],
     texts: ['Textos del Sitio', 'Modificá los textos que aparecen en el sitio', '+ Nuevo Texto'],
     reviews: ['Reseñas', 'Gestioná reseñas de clientes', ''],
     reports: ['Reportes', 'Ventas, ticket promedio y productos más vendidos', ''],
     categories: ['Categorías', 'Gestioná las categorías de productos', '+ Nueva Categoría'],
     subscribers: ['Suscriptores', 'Gestioná suscriptores del newsletter', ''],
     payments: ['Pagos', 'Revisá y gestioná los pagos', ''],
     settings: ['Configuración', 'Ajustes del sitio y del negocio', '']
   };
   const [title, subtitle, action] = titles[section] || titles.products;
   document.getElementById('sectionTitle').textContent = title;
   document.getElementById('sectionSubtitle').textContent = subtitle;
   document.getElementById('sectionAction').textContent = action;
   const statsEl = document.getElementById('dashboardStats');
   if (statsEl) statsEl.style.display = section === 'products' || section === 'orders' || section === 'reviews' ? 'grid' : 'none';
   if (section === 'products') { loadProducts(); loadDashboardStats(); }
   if (section === 'orders') { loadOrders(); loadDashboardStats(); }
   if (section === 'testimonials') loadTestimonials();
   if (section === 'texts') loadSiteTexts();
   if (section === 'reviews') { loadReviews(); loadDashboardStats(); }
   if (section === 'reports') loadSalesReport();
   if (section === 'categories') loadCategories();
   if (section === 'subscribers') loadSubscribers();
   if (section === 'payments') loadPayments();
   if (section === 'settings') loadSettings();
 }

function openSectionModal() {
   if (currentSection === 'products') openModal();
   if (currentSection === 'testimonials') openTestimonialModal();
   if (currentSection === 'texts') openTextModal();
   if (currentSection === 'categories') openCategoryModal();
 }

document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.getAttribute('data-section'));
  });
});

let currentProductPage = 1;
const PRODUCTS_PER_PAGE = 10;

async function loadProducts() {
  try {
    const search = document.getElementById('productSearch')?.value || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    const qs = new URLSearchParams({ search, category, page: String(currentProductPage), limit: String(PRODUCTS_PER_PAGE) });
    const res = await adminFetch(`/api/admin/products?${qs.toString()}`);
    const json = await res.json();
    products = json.data || [];
    productMeta = json.meta || {};
    renderProductsTable();
    renderProductPagination();
  } catch (err) {
    setHTML(document.getElementById('tableBody'), `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderProductPagination() {
  const container = document.getElementById('productPagination');
  if (!container) return;
  const { page = 1, totalPages = 1 } = productMeta || {};
  if (totalPages <= 1) {
    setHTML(container, '');
    return;
  }
  setHTML(container, `
    <button class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled style="opacity:.5;"' : ''} onclick="currentProductPage=${page - 1};loadProducts();">← Anterior</button>
    <span style="font-size:0.85rem;color:var(--text-muted);">Página ${page} de ${totalPages}</span>
    <button class="btn btn-secondary btn-sm" ${page >= totalPages ? 'disabled style="opacity:.5;"' : ''} onclick="currentProductPage=${page + 1};loadProducts();">Siguiente →</button>
  `);
}

function renderProductsTable() {
  const search = document.getElementById('productSearch')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const qs = new URLSearchParams({ search, category, page: String(currentProductPage), limit: String(PRODUCTS_PER_PAGE) });
  adminFetch(`/api/admin/products?${qs.toString()}`)
    .then(res => res.json())
    .then(json => {
      products = json.data || [];
      productMeta = json.meta || {};
      const tbody = document.getElementById('tableBody');
      if (products.length === 0) {
        setHTML(tbody, '<tr><td colspan="6" class="empty-state"><h3>Sin productos</h3><p>No se encontraron productos.</p></td></tr>');
        return;
      }
      tbody.innerHTML = products.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        const primaryImg = images.find(img => img.is_primary) || images[0];
        const imgUrl = primaryImg ? primaryImg.url : (p.image || '');
        const stock = Number(p.stock ?? 0);
        const stockClass = stock === 0 ? 'stock-out' : stock <= 5 ? 'stock-low' : '';
        const catClass = p.category ? `badge-${p.category}` : '';
        return `
          <tr>
            <td>
              <div class="product-cell">
                <div class="thumb">${imgUrl ? `<img src="${imgUrl}" alt="${p.name}">` : p.emoji || '📿'}</div>
                <div>
                  <div class="product-name">${p.name}</div>
                  <div class="product-desc">${p.description || ''}</div>
                </div>
              </div>
            </td>
            <td><span class="badge ${catClass}">${p.category || '—'}</span></td>
            <td class="price-cell">$${Number(p.price).toLocaleString('es-AR')}</td>
            <td class="stock-cell ${stockClass}">${stock}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="openGallery(${p.id}, '${p.name}')">
                ${images.length > 0 ? `🖼 (${images.length})` : '📷'}
              </button>
            </td>
            <td>
              <div class="actions">
                <button class="btn btn-secondary btn-sm" onclick="editProduct(${p.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">🗑</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    })
    .catch(err => {
      setHTML(document.getElementById('tableBody'), `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`);
    });
  renderProductPagination();
}

async function loadOrders() {
   try {
     currentOrderPage = 1;
     const page = currentOrderPage;
     const limit = ORDERS_PER_PAGE || 20;
     const res = await adminFetch(`/api/admin/orders?page=${page}&limit=${limit}`);
     const json = await res.json();
     orders = json.data || json;
     ordersMeta = json.meta || {};
     filteredOrders = orders;
     currentOrderPage = page;
     renderOrdersTable();
     renderOrdersPagination();
   } catch (err) {
     setHTML(document.getElementById('ordersTableBody'), `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`);
   }
 }

async function loadDashboardStats() {
   try {
     const [productsRes, ordersRes, reviewsRes] = await Promise.all([
       adminFetch('/api/admin/products?limit=1').catch(() => ({ json: () => ({ meta: { total: 0 } }) })),
       adminFetch('/api/admin/orders?limit=1').catch(() => ({ json: () => ({ meta: { total: 0 } }) })),
       adminFetch('/api/admin/reviews?limit=1').catch(() => ({ json: () => ({ meta: { total: 0 } }) }))
     ]);
     const productsData = await productsRes.json().catch(() => ({ meta: { total: 0 } }));
     const ordersData = await ordersRes.json().catch(() => ({ meta: { total: 0 } }));
     const reviewsData = await reviewsRes.json().catch(() => ({ meta: { total: 0 } }));
     const statProducts = document.getElementById('statProducts');
     const statOrders = document.getElementById('statOrders');
     const statReviews = document.getElementById('statReviews');
     if (statProducts) statProducts.textContent = productsData.meta?.total || productsData.data?.length || 0;
     if (statOrders) statOrders.textContent = ordersData.meta?.total || ordersData.data?.length || 0;
     if (statReviews) statReviews.textContent = reviewsData.meta?.total || reviewsData.data?.length || 0;
     let revenue = 0;
     orders.forEach(o => {
       if (['approved', 'in_process', 'shipped', 'delivered'].includes(o.status)) {
         revenue += Number(o.total || 0);
       }
     });
     const statRevenue = document.getElementById('statRevenue');
     if (statRevenue) statRevenue.textContent = '$' + revenue.toLocaleString('es-AR');
     await loadAnalytics();
   } catch (err) {
     console.error('Error loading stats:', err);
   }
 }

let salesChartInstance = null;
let topProductsChartInstance = null;

async function loadAnalytics() {
  try {
    const ordersRes = await adminFetch('/api/admin/orders?limit=100').catch(() => ({ json: () => ({ data: [] }) }));
    const ordersData = await ordersRes.json().catch(() => ({ data: [] }));
    const orders = ordersData.data || [];

    const productsRes = await adminFetch('/api/admin/products?limit=1000').catch(() => ({ json: () => ({ data: [] }) }));
    const productsData = await productsRes.json().catch(() => ({ data: [] }));
    const products = productsData.data || [];
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p.name; });

    const dailySales = {};
    const productSales = {};

    orders.forEach(o => {
      const date = new Date(o.created_at).toISOString().split('T')[0];
      dailySales[date] = (dailySales[date] || 0) + Number(o.total || 0);

      const items = JSON.parse(o.items || '[]');
      items.forEach(item => {
        const pid = Number(item.id);
        const qty = Number(item.qty || 1);
        const name = productMap[pid] || `Producto #${pid}`;
        productSales[name] = (productSales[name] || 0) + qty;
      });
    });

    const dailyChartData = Object.entries(dailySales)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, total]) => ({ date, total }));

    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, qty]) => ({ name, qty }));

    const chartsContainer = document.getElementById('dashboardCharts');
    if (chartsContainer) chartsContainer.style.display = 'grid';

    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
      if (salesChartInstance) salesChartInstance.destroy();
      salesChartInstance = new Chart(salesCtx, {
        type: 'bar',
        data: {
          labels: dailyChartData.map(d => d.date.slice(5)),
          datasets: [{
            label: 'Ventas (ARS)',
            data: dailyChartData.map(d => d.total),
            backgroundColor: 'rgba(232, 121, 140, 0.7)',
            borderColor: 'rgba(232, 121, 140, 1)',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString('es-AR') } } }
        }
      });
    }

    const topCtx = document.getElementById('topProductsChart');
    if (topCtx) {
      if (topProductsChartInstance) topProductsChartInstance.destroy();
      const colors = ['#e8798c', '#f4a261', '#2a9d8f', '#e9c46a', '#264653', '#8ab17d', '#a8dadc', '#457b9d'];
      topProductsChartInstance = new Chart(topCtx, {
        type: 'doughnut',
        data: {
          labels: topProducts.map(p => p.name),
          datasets: [{
            data: topProducts.map(p => p.qty),
            backgroundColor: colors.slice(0, topProducts.length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } }
        }
      });
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function filterOrders(status) {
  const buttons = document.querySelectorAll('#orderStatusFilter .status-btn');
  buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.status === status));
  if (status === 'all') {
    filteredOrders = orders;
  } else {
    filteredOrders = orders.filter(o => o.status === status);
  }
  renderOrdersTable();
}

function renderOrdersTable() {
   const q = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();
   const filtered = filteredOrders.filter(o => {
     const customer = o.customer || {};
     const text = `${o.id} ${customer.name || ''} ${customer.email || ''} ${o.status}`.toLowerCase();
     return text.includes(q);
   });
   const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
   if (currentOrderPage > totalPages) currentOrderPage = totalPages;
   const start = (currentOrderPage - 1) * ORDERS_PER_PAGE;
   const pageItems = filtered.slice(start, start + ORDERS_PER_PAGE);
   const tbody = document.getElementById('ordersTableBody');
   if (pageItems.length === 0) {
     setHTML(tbody, '<tr><td colspan="6" class="empty-state"><h3>Sin pedidos</h3><p>No se encontraron pedidos.</p></td></tr>');
     return;
   }
   tbody.innerHTML = pageItems.map(o => {
     const customer = o.customer || {};
     const statusClass = o.status === 'approved' ? 'approved' : o.status === 'pending' || o.status === 'pending_payment' ? 'pending' : o.status === 'cancelled' || o.status === 'rejected' || o.status === 'failed' ? 'rejected' : o.status === 'shipped' ? 'shipped' : o.status === 'delivered' ? 'approved' : 'pending';
     return `
       <tr>
         <td><strong>#${o.id}</strong></td>
         <td>${customer.name || 'Sin nombre'}<br/><small>${customer.email || ''}</small></td>
         <td>$${Number(o.total).toLocaleString('es-AR')}</td>
         <td><span class="badge badge-${statusClass}">${o.status || 'pending'}</span></td>
         <td>${o.created_at ? new Date(o.created_at).toLocaleDateString('es-AR') : '—'}</td>
         <td>
           <div class="actions">
             <button class="btn btn-secondary btn-sm" onclick="viewOrder(${o.id})">👁 Ver</button>
             <button class="btn btn-secondary btn-sm" onclick="openOrderDetail(${o.id})">✏️ Editar</button>
           </div>
         </td>
       </tr>
     `;
   }).join('');
   renderOrdersPagination(totalPages);
 }

 function renderOrdersPagination(totalPages) {
   const container = document.getElementById('ordersPagination');
   if (!container) return;
   if (totalPages <= 1) { setHTML(container, ''); return; }
   setHTML(container, `
     <button class="btn btn-secondary btn-sm" ${currentOrderPage <= 1 ? 'disabled style="opacity:.5;"' : ''} onclick="currentOrderPage=${currentOrderPage - 1};loadOrders();">← Anterior</button>
     <span style="font-size:0.85rem;color:var(--text-muted);">Página ${currentOrderPage} de ${totalPages}</span>
     <button class="btn btn-secondary btn-sm" ${currentOrderPage >= totalPages ? 'disabled style="opacity:.5;"' : ''} onclick="currentOrderPage=${currentOrderPage + 1};loadOrders();">Siguiente →</button>
   `);
 }

function viewOrder(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  const customer = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsText = items.map((it, i) => `${i + 1}. ${it.name || 'Producto'} x${it.quantity || 1} — $${Number(it.price || 0).toLocaleString('es-AR')}`).join('\n');
  alert(`Pedido #${order.id}\n\nCliente: ${customer.name || '—'}\nEmail: ${customer.email || '—'}\nTeléfono: ${customer.phone || '—'}\nDirección: ${customer.address || '—'}\n\nItems:\n${itemsText}\n\nTotal: $${Number(order.total).toLocaleString('es-AR')}\nEstado: ${order.status || 'pending'}\nMercadoPago ID: ${order.mercadopago_id || '—'}`);
}

async function openOrderDetail(id) {
  currentOrderId = id;
  const order = orders.find(o => o.id === id);
  if (!order) return;
  const customer = order.customer || {};
  document.getElementById('orderDetailId').textContent = order.id;
  document.getElementById('orderStatusSelect').value = order.status || 'pending';
  document.getElementById('orderMpId').textContent = order.mercadopago_id || '—';
  document.getElementById('orderCustomerName').textContent = customer.name || '—';
  document.getElementById('orderCustomerEmail').textContent = customer.email || '—';
  document.getElementById('orderCustomerPhone').textContent = customer.phone || '—';
  document.getElementById('orderCustomerAddress').textContent = customer.address || '—';
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items.map(it => `
    <div class="order-item-row">
      <span class="order-item-name">${it.name || 'Producto'} <span class="order-item-qty">x${it.quantity || 1}</span></span>
      <span class="order-item-price">$${(Number(it.price || 0) * (it.quantity || 1)).toLocaleString('es-AR')}</span>
    </div>
  `).join('');
  document.getElementById('orderItemsList').innerHTML = itemsHtml;
  document.getElementById('orderTotalAmount').textContent = '$' + Number(order.total || 0).toLocaleString('es-AR');
  document.getElementById('orderDetailOverlay').classList.add('active');
}

function closeOrderDetail() {
  document.getElementById('orderDetailOverlay').classList.remove('active');
  currentOrderId = null;
}

async function saveOrderStatus() {
  if (!currentOrderId) return;
  const status = document.getElementById('orderStatusSelect').value;
  try {
    await adminFetch(`/api/admin/orders/${currentOrderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await loadOrders();
    closeOrderDetail();
    showToast('Estado del pedido actualizado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openGallery(productId, productName) {
  document.getElementById('galleryProductName').textContent = productName || '';
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '<p style="color:var(--text-muted)">Cargando...</p>';
  document.getElementById('galleryOverlay').classList.add('active');
  try {
    const res = await adminFetch(`/api/admin/product-images/${productId}/images`);
    const images = await res.json();
    if (!images || images.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted)">Sin imágenes</p>';
      return;
    }
    grid.innerHTML = images.map(img => `
      <div class="gallery-item ${img.is_primary ? 'primary' : ''}">
        <img src="${img.url}" alt="${img.alt || ''}" loading="lazy" />
        <button onclick="deleteProductImage(${productId}, ${img.id})">✕</button>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
  }
}

function closeGallery() {
  document.getElementById('galleryOverlay').classList.remove('active');
}

async function deleteProductImage(productId, imageId) {
  if (!confirm('¿Eliminar esta imagen?')) return;
  try {
    await adminFetch(`/api/admin/product-images/${productId}/images/${imageId}`, { method: 'DELETE' });
    showToast('Imagen eliminada', 'success');
    openGallery(productId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadTestimonials() {
  try {
    const res = await adminFetch('/api/admin/testimonials');
    testimonials = await res.json();
    renderTestimonialsTable();
  } catch (err) {
setHTML(    document.getElementById('testimonialsTableBody'), `<tr><td colspan="5" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderTestimonialsTable() {
  const tbody = document.getElementById('testimonialsTableBody');
  if (testimonials.length === 0) {
    setHTML(tbody, '<tr><td colspan="5" class="empty-state"><h3>Sin testimonios</h3><p>Agregá el primero.</p></td></tr>');
    return;
  }
  tbody.innerHTML = testimonials.map(t => `
    <tr>
      <td><strong>${t.name}</strong></td>
      <td>${t.comment}</td>
      <td>${'⭐'.repeat(t.rating)}</td>
      <td>${t.active ? '✅ Activo' : '❌ Inactivo'}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="editTestimonial(${t.id})">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTestimonial(${t.id})">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadSiteTexts() {
  try {
    const res = await adminFetch('/api/admin/site-texts');
    siteTexts = await res.json();
    renderTextsTable();
  } catch (err) {
setHTML(    document.getElementById('textsTableBody'), `<tr><td colspan="3" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderTextsTable() {
  const tbody = document.getElementById('textsTableBody');
  const keys = Object.keys(siteTexts);
  if (keys.length === 0) {
    setHTML(tbody, '<tr><td colspan="3" class="empty-state"><h3>Sin textos</h3><p>Agregá el primero.</p></td></tr>');
    return;
  }
  tbody.innerHTML = keys.map(key => `
    <tr>
      <td><code>${key}</code></td>
      <td>${siteTexts[key] || ''}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="editText('${key}')">✏️ Editar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openModal(product = null) {
  editingId = product ? product.id : null;
  document.getElementById('modalTitle').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('pName').value = product ? product.name : '';
  document.getElementById('pCategory').value = product ? product.category : 'pulseras';
  document.getElementById('pPrice').value = product ? product.price : '';
  document.getElementById('pDesc').value = product ? product.description : '';
  document.getElementById('pImage').value = product ? (product.image || '') : '';
  document.getElementById('pImageFile').value = '';
  document.getElementById('pId').value = editingId || '';
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingId = null;
}

function openTestimonialModal(testimonial = null) {
  editingId = testimonial ? testimonial.id : null;
  document.getElementById('testimonialModalTitle').textContent = testimonial ? 'Editar Testimonio' : 'Nuevo Testimonio';
  document.getElementById('tName').value = testimonial ? testimonial.name : '';
  document.getElementById('tComment').value = testimonial ? testimonial.comment : '';
  document.getElementById('tRating').value = testimonial ? testimonial.rating : 5;
  document.getElementById('tId').value = editingId || '';
  document.getElementById('testimonialModalOverlay').classList.add('active');
}

function closeTestimonialModal() {
  document.getElementById('testimonialModalOverlay').classList.remove('active');
  editingId = null;
}

function openTextModal(key = null) {
  editingId = key;
  document.getElementById('textModalTitle').textContent = key ? 'Editar Texto' : 'Nuevo Texto';
  document.getElementById('textKey').value = key || '';
  document.getElementById('textKey').disabled = !!key;
  document.getElementById('textValue').value = key ? (siteTexts[key] || '') : '';
  document.getElementById('textModalOverlay').classList.add('active');
}

function closeTextModal() {
  document.getElementById('textModalOverlay').classList.remove('active');
  editingId = null;
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (p) openModal(p);
}

function editTestimonial(id) {
  const t = testimonials.find(x => x.id === id);
  if (t) openTestimonialModal(t);
}

function editText(key) {
  openTextModal(key);
}

async function saveProduct() {
  const name = document.getElementById('pName').value.trim();
  const category = document.getElementById('pCategory').value;
  const price = Number(document.getElementById('pPrice').value);
  const description = document.getElementById('pDesc').value.trim();
  const imageInput = document.getElementById('pImage').value.trim();
  const fileInput = document.getElementById('pImageFile');
  const id = Number(document.getElementById('pId').value) || null;
  const existingProduct = id ? products.find(x => x.id === id) : null;

  if (!name || !price) {
    showToast('Nombre y precio son obligatorios', 'error');
    return;
  }

  let image = imageInput;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });
      if (!res.ok) throw new Error('Error al subir imagen');
      const data = await res.json();
      image = data.url || imageInput;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const payload = {
    name,
    category,
    price,
    description,
    image,
    emoji: existingProduct ? existingProduct.emoji : '📿',
    badge: existingProduct ? existingProduct.badge : ''
  };

  try {
    if (id) {
      await adminFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await adminFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    await loadProducts();
    closeModal();
    showToast('Producto guardado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function markOutOfStock(id) {
  if (!confirm('¿Marcar este producto como sin stock?')) return;
  try {
    await adminFetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: 0 })
    });
    await loadProducts();
    showToast('Producto marcado como sin stock', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar producto?')) return;
  try {
    await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    products = products.filter(p => p.id !== id);
    renderProductsTable();
    showToast('Producto eliminado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveTestimonial() {
  const name = document.getElementById('tName').value.trim();
  const comment = document.getElementById('tComment').value.trim();
  const rating = Number(document.getElementById('tRating').value);
  const id = Number(document.getElementById('tId').value) || null;

  if (!name || !comment) {
    showToast('Nombre y comentario son obligatorios', 'error');
    return;
  }

  const payload = { name, comment, rating, active: true };

  try {
    if (id) {
      await adminFetch(`/api/admin/testimonials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await adminFetch('/api/admin/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    await loadTestimonials();
    closeTestimonialModal();
    showToast('Testimonio guardado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTestimonial(id) {
  if (!confirm('¿Eliminar testimonio?')) return;
  try {
    await adminFetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    testimonials = testimonials.filter(t => t.id !== id);
    renderTestimonialsTable();
    showToast('Testimonio eliminado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveText() {
  const key = document.getElementById('textKey').value.trim();
  const value = document.getElementById('textValue').value;

  if (!key) {
    showToast('La clave es obligatoria', 'error');
    return;
  }

  try {
    await adminFetch('/api/admin/site-texts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    await loadSiteTexts();
    closeTextModal();
    showToast('Texto guardado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});
document.getElementById('testimonialModalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('testimonialModalOverlay')) closeTestimonialModal();
});
document.getElementById('textModalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('textModalOverlay')) closeTextModal();
});

document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    document.getElementById('loginOverlay').classList.add('hidden');
    navigateTo('products');
  }

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);

  const loginPassEl = document.getElementById('loginPass');
  if (loginPassEl) loginPassEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  const sectionAction = document.getElementById('sectionAction');
  if (sectionAction) sectionAction.addEventListener('click', openSectionModal);
});

async function loadReviews() {
  try {
    const res = await adminFetch('/api/admin/reviews');
    reviews = await res.json();
    renderReviewsTable();
  } catch (err) {
    const tbody = document.getElementById('reviewsTableBody');
    if (tbody) setHTML(tbody, `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderReviewsTable() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;
  if (reviews.length === 0) {
    setHTML(tbody, '<tr><td colspan="6" class="empty-state"><h3>Sin reseñas</h3><p>Las reseñas de clientes aparecerán acá.</p></td></tr>');
    return;
  }
  tbody.innerHTML = reviews.map(r => `
    <tr>
      <td>Producto #${r.product_id}</td>
      <td><strong>${r.customer_name}</strong></td>
      <td>${r.comment}</td>
      <td>${'⭐'.repeat(r.rating)}</td>
      <td>${r.active ? '✅ Activo' : '❌ Inactivo'}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-action="toggle-review" data-id="${r.id}">${r.active ? 'Ocultar' : 'Mostrar'}</button>
          <button class="btn btn-danger btn-sm" data-action="delete-review" data-id="${r.id}">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="toggle-review"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const review = reviews.find(r => r.id === id);
      if (!review) return;
      try {
        await adminFetch(`/api/admin/reviews/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !review.active })
        });
        await loadReviews();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
  tbody.querySelectorAll('button[data-action="delete-review"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta reseña?')) return;
      try {
        await adminFetch(`/api/admin/reviews/${Number(btn.dataset.id)}`, { method: 'DELETE' });
        await loadReviews();
        showToast('Reseña eliminada', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function exportCSV(type) {
  let data = [];
  let filename = 'export.csv';
  let headers = [];

  if (type === 'products') {
    data = products;
    filename = 'productos.csv';
    headers = ['ID', 'Nombre', 'Categoría', 'Precio', 'Descripción', 'Badge'];
  } else if (type === 'testimonials') {
    data = testimonials;
    filename = 'testimonios.csv';
    headers = ['ID', 'Nombre', 'Comentario', 'Valoración', 'Activo'];
  } else if (type === 'orders') {
    data = orders;
    filename = 'pedidos.csv';
    headers = ['ID', 'Cliente', 'Email', 'Total', 'Estado', 'Fecha'];
  }

  if (!data.length) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  const csvContent = [
    headers.join(','),
    ...data.map(row => {
      if (type === 'products') {
        return [row.id, `"${(row.name || '').replace(/"/g, '""')}"`, row.category, row.price, `"${(row.description || '').replace(/"/g, '""')}"`, row.badge || ''].join(',');
      } else if (type === 'testimonials') {
        return [row.id, `"${(row.name || '').replace(/"/g, '""')}"`, `"${(row.comment || '').replace(/"/g, '""')}"`, row.rating, row.active].join(',');
      } else if (type === 'orders') {
        const customer = row.customer || {};
        return [row.id, `"${(customer.name || '').replace(/"/g, '""')}"`, `"${(customer.email || '').replace(/"/g, '""')}"`, row.total, row.status, row.created_at || ''].join(',');
      }
    })
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('CSV exportado correctamente', 'success');
}

// ============================================================
// REPORTES DE VENTAS
// ============================================================
function money(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function loadSalesReport() {
  try {
    const days = Number(document.getElementById('reportRange')?.value || 30);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    const res = await adminFetch(`/api/admin/reports/sales?${qs.toString()}`);
    const data = await res.json();

    document.getElementById('reportRevenue').textContent = money(data.totalRevenue);
    document.getElementById('reportOrders').textContent = data.totalOrders;
    document.getElementById('reportAvgTicket').textContent = money(data.avgTicket);

    const chart = document.getElementById('reportByDayChart');
    if (data.byDay.length === 0) {
      chart.innerHTML = '<p class="empty-state">Sin ventas en el período.</p>';
    } else {
      const max = Math.max(...data.byDay.map((d) => d.revenue), 1);
      chart.innerHTML = data.byDay.map((d) => {
        const h = Math.max(4, Math.round((d.revenue / max) * 100));
        return `<div title="${d.day}: ${money(d.revenue)}" style="flex:0 0 auto;width:18px;height:${h}px;background:var(--brand-color,#d47090);border-radius:3px 3px 0 0;"></div>`;
      }).join('');
    }

    const tbody = document.getElementById('reportTopProductsBody');
    if (data.topProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Sin datos todavía.</td></tr>';
    } else {
      tbody.innerHTML = data.topProducts.map((p) => `
        <tr>
          <td>${p.name || 'Producto #' + p.id}</td>
          <td>${p.quantity}</td>
          <td>${money(p.revenue)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    showToast('Error cargando el reporte: ' + err.message, 'error');
  }
}

document.getElementById('reportRange')?.addEventListener('change', loadSalesReport);

// ============================================================
// CATEGORÍAS
// ============================================================
async function loadCategories() {
  try {
    const res = await adminFetch('/api/admin/categories');
    const data = await res.json();
    window._categories = data;
    renderCategoriesTable(data);
  } catch (err) {
    setHTML(document.getElementById('categoriesTableBody'), `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderCategoriesTable(categories) {
  const tbody = document.getElementById('categoriesTableBody');
  if (!categories || categories.length === 0) {
    setHTML(tbody, '<tr><td colspan="6" class="empty-state"><h3>Sin categorías</h3><p>Agregá la primera.</p></td></tr>');
    return;
  }
  tbody.innerHTML = categories.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td><code>${c.slug}</code></td>
      <td>${c.icon || '📂'}</td>
      <td>${c.active ? '✅' : '❌'}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="editCategory(${c.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id})">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openCategoryModal(category = null) {
   editingId = category ? category.id : null;
   document.getElementById('modalTitle').textContent = category ? 'Editar Categoría' : 'Nueva Categoría';
   document.getElementById('pName').value = category ? category.name : '';
   document.getElementById('pCategory').value = category ? category.slug || 'pulseras' : 'pulseras';
   document.getElementById('pPrice').value = '';
   document.getElementById('pDesc').value = category ? category.description || '' : '';
   document.getElementById('pImage').value = '';
   document.getElementById('pImageFile').value = '';
   document.getElementById('pId').value = editingId || '';
   document.querySelector('#modalOverlay .modal-header h3').textContent = category ? 'Editar Categoría' : 'Nueva Categoría';
   document.getElementById('modalOverlay').classList.add('active');
 }

async function saveCategory() {
  const name = document.getElementById('pName').value.trim();
  const slug = document.getElementById('pCategory').value;
  const description = document.getElementById('pDesc').value.trim();
  if (!name || !slug) { showToast('Nombre y slug son obligatorios', 'error'); return; }
  try {
    if (editingId) {
      await adminFetch(`/api/admin/categories/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description })
      });
    } else {
      await adminFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description })
      });
    }
    await loadCategories();
    closeModal();
    showToast('Categoría guardada', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  try {
    await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    await loadCategories();
    showToast('Categoría eliminada', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editCategory(id) {
  const cat = window._categories?.find(c => c.id === id);
  if (cat) openCategoryModal(cat);
}

// ============================================================
// SUSCRIPTORES
// ============================================================
async function loadSubscribers() {
  try {
    const res = await adminFetch('/api/admin/subscribers');
    const data = await res.json();
    window._subscribers = data.data || data;
    renderSubscribersTable();
  } catch (err) {
    setHTML(document.getElementById('subscribersTableBody'), `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderSubscribersTable() {
  const q = (document.getElementById('subscriberSearch')?.value || '').toLowerCase();
  const filtered = (window._subscribers || []).filter(s => {
    const text = `${s.email} ${s.name || ''}`.toLowerCase();
    return text.includes(q);
  });
  const tbody = document.getElementById('subscribersTableBody');
  if (filtered.length === 0) {
    setHTML(tbody, '<tr><td colspan="6" class="empty-state"><h3>Sin suscriptores</h3></td></tr>');
    return;
  }
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.email}</td>
      <td>${s.name || '—'}</td>
      <td>${s.active ? '✅' : '❌'}</td>
      <td>${s.created_at ? new Date(s.created_at).toLocaleDateString('es-AR') : '—'}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="toggleSubscriber(${s.id}, ${!s.active})">${s.active ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSubscriber(${s.id})">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function toggleSubscriber(id, active) {
  try {
    await adminFetch(`/api/admin/subscribers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    await loadSubscribers();
    showToast('Suscriptor actualizado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSubscriber(id) {
  if (!confirm('¿Eliminar este suscriptor?')) return;
  try {
    await adminFetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
    await loadSubscribers();
    showToast('Suscriptor eliminado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// PAGOS
// ============================================================
async function loadPayments() {
  try {
    const res = await adminFetch('/api/admin/payments');
    const data = await res.json();
    window._payments = data.data || data;
    renderPaymentsTable();
  } catch (err) {
    setHTML(document.getElementById('paymentsTableBody'), `<tr><td colspan="8" class="empty-state">Error: ${err.message}</td></tr>`);
  }
}

function renderPaymentsTable() {
  const filter = document.getElementById('paymentStatusFilter')?.value || '';
  const filtered = filter ? (window._payments || []).filter(p => p.status === filter) : (window._payments || []);
  const tbody = document.getElementById('paymentsTableBody');
  if (filtered.length === 0) {
    setHTML(tbody, '<tr><td colspan="8" class="empty-state"><h3>Sin pagos</h3></td></tr>');
    return;
  }
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>#${p.order_id || '—'}</td>
      <td>${p.mercadopago_id || '—'}</td>
      <td>$${Number(p.amount || 0).toLocaleString('es-AR')}</td>
      <td><span class="badge badge-${p.status === 'approved' ? 'approved' : p.status === 'rejected' || p.status === 'cancelled' ? 'rejected' : 'pending'}">${p.status || 'pending'}</span></td>
      <td>${p.payment_method_id || '—'}</td>
      <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—'}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="updatePaymentStatus(${p.id})">Cambiar estado</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function updatePaymentStatus(id) {
  const current = window._payments?.find(p => p.id === id);
  if (!current) return;
  const newStatus = prompt('Nuevo estado:', current.status);
  if (!newStatus || newStatus === current.status) return;
  try {
    await adminFetch(`/api/admin/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    await loadPayments();
    showToast('Estado del pago actualizado', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// CONFIGURACIÓN
// ============================================================
async function loadSettings() {
  try {
    const res = await adminFetch('/api/admin/settings');
    const data = await res.json();
    document.getElementById('setBusinessName').value = data.business?.name || '';
    document.getElementById('setBusinessEmail').value = data.business?.email || '';
    document.getElementById('setWhatsapp').value = data.business?.whatsapp || '';
    document.getElementById('setShippingCost').value = data.shipping?.cost || 200;
    document.getElementById('setShippingThreshold').value = data.shipping?.threshold || 2000;
    document.getElementById('setInstagram').value = data.business?.instagram || '';
    document.getElementById('setFacebook').value = data.business?.facebook || '';
    document.getElementById('setTwitter').value = data.business?.twitter || '';
  } catch (err) {
    showToast('Error cargando configuración: ' + err.message, 'error');
  }
}

async function saveSettings() {
  const payload = {
    business: {
      name: document.getElementById('setBusinessName').value.trim(),
      email: document.getElementById('setBusinessEmail').value.trim(),
      whatsapp: document.getElementById('setWhatsapp').value.trim(),
      instagram: document.getElementById('setInstagram').value.trim(),
      facebook: document.getElementById('setFacebook').value.trim(),
      twitter: document.getElementById('setTwitter').value.trim()
    },
    shipping: {
      cost: Number(document.getElementById('setShippingCost').value) || 200,
      threshold: Number(document.getElementById('setShippingThreshold').value) || 2000
    }
  };
  try {
    await adminFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast('Configuración guardada', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
