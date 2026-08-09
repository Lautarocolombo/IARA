/* global Chart */
const API_BASE = CONFIG.API.BASE;
        let authToken = '';
        window.__getAdminToken = () => authToken;
      let currentSection = 'products';
      let products = [];
      let categories = [];
      let orders = [];
      let testimonials = [];
      let siteTexts = {};
       let heroCards = [];
       let heroPendingFiles = {};
       let editingId = null;
       let ordersCurrentPage = 1;
       let ordersTotalPages = 1;

      function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function safeJsonParse(str, fallback) {
        try { return JSON.parse(str); } catch (e) { return fallback; }
      }

     function getApiUrl(path) {
      if (!API_BASE) return path;
      return `${API_BASE}${path}`;
    }

    function navigateTo(section) {
      currentSection = section;
      document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
      document.querySelector(`.sidebar-nav a[data-section="${section}"]`)?.classList.add('active');
       const sections = ['products','categories','orders','reports','testimonials','texts','heroImages','settings'];
       sections.forEach(s => { const el = document.getElementById(s+'Section'); if(el) el.style.display = s===section?'block':'none'; });
       const titles = {
         products: ['Productos', 'Gestioná productos, fotos y precios', '+ Nuevo Producto'],
         categories: ['Categorías', 'Gestioná categorías y subcategorías', '+ Nueva Categoría'],
         orders: ['Pedidos', 'Gestioná pedidos y pagos', ''],
         reports: ['Reportes', 'Analíticas de ventas y productos', ''],
         testimonials: ['Testimonios', 'Gestioná testimonios de clientes', ''],
         texts: ['Textos del Sitio', 'Modificá los textos que aparecen en el sitio', ''],
         heroImages: ['Imágenes del Hero', 'Editá las imágenes y textos de las cards del hero', ''],
         settings: ['Configuración', 'Gestioná la configuración general y de pago', ''],
       };
       const [title, subtitle, action] = titles[section] || titles.products;
       document.getElementById('sectionTitle').textContent = title;
       document.getElementById('sectionSubtitle').textContent = subtitle;
       const actionBtn = document.getElementById('sectionAction');
       if (action) { actionBtn.textContent = action; actionBtn.style.display = ''; } else { actionBtn.style.display = 'none'; }
       if (section === 'products') loadProducts();
       if (section === 'categories') loadCategories();
       if (section === 'orders') loadOrders();
        if (section === 'reports') { loadSalesReport(); loadSalesTrend(); loadWeeklySummary(); }
       if (section === 'testimonials') loadTestimonials();
       if (section === 'texts') loadSiteTexts();
       if (section === 'heroImages') loadHeroCardsAdmin();
       if (section === 'settings') loadSettings();
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
       const validSections = ['products','categories','orders','reports','testimonials','texts','heroImages','settings'];
       if (validSections.includes(hash)) {
         navigateTo(hash);
       }
    });

    async function checkServerHealth() {
      const btn = document.getElementById('loginBtn');
      const hint = document.getElementById('loginHint');
      const retryBtn = document.getElementById('retryHealthBtn');
      let controller = new AbortController();
      const timeoutMs = 8000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        btn.textContent = 'Verificando...';
        btn.disabled = true;
        const fetchPromise = fetch(getApiUrl('/api/health'), {
          method: 'GET',
          signal: controller.signal
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        );
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Servidor respondió con estado ${res.status}`);
        hint.textContent = '✅ Servidor conectado';
        hint.style.color = '#10b981';
        if (retryBtn) retryBtn.style.display = 'none';
      } catch (err) {
        clearTimeout(timeoutId);
        const isAborted = err.name === 'AbortError';
        const isTimeout = err.message === 'timeout';
        let message = '⚠️ El servidor no responde. Podés intentar igualmente iniciar sesión.';
        if (isTimeout) {
          message = '⚠️ La verificación tardó demasiado. Podés intentar igualmente iniciar sesión.';
        } else if (isAborted) {
          message = '⚠️ La conexión se canceló. Podés intentar igualmente iniciar sesión.';
        }
        hint.textContent = message;
        hint.style.color = '#f59e0b';
        if (retryBtn) {
          retryBtn.style.display = 'inline-block';
          retryBtn.onclick = () => { checkServerHealth(); };
        }
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
        document.getElementById('loginHint').textContent = '⚠️ Abrí este panel desde el servidor.';
        document.getElementById('loginHint').style.color = '#ef4444';
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
      const errorEl = document.getElementById('loginError');
      clearLoginError(errorEl);
      if (!username || !password) {
        showLoginError(errorEl, 'Ingresá usuario y contraseña');
        return;
      }
      const btn = document.getElementById('loginBtn');
      try {
        btn.textContent = 'Ingresando...';
        btn.disabled = true;
        const controller = new AbortController();
        const timeoutMs = 15000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const fetchPromise = fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
          signal: controller.signal
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        );
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          let errorMsg = data.error || `Error ${res.status}`;
          if (res.status === 401) {
            errorMsg = 'Usuario o contraseña incorrectos';
          } else if (res.status === 400) {
            errorMsg = data.error || 'Datos inválidos';
          } else if (res.status === 500) {
            errorMsg = 'Error en el servidor. Recargá la página e intentá nuevamente.';
          } else if (res.status === 403) {
            errorMsg = 'Acceso denegado';
          }
          throw new Error(errorMsg);
        }
        authToken = data.token;
        document.getElementById('loginOverlay').classList.add('hidden');
        showToast(`Bienvenida, ${data.user}`, 'success');
        navigateTo('products');
      } catch (err) {
        let userMessage = 'Error inesperado. Por favor, recargá la página.';
        if (err.message === 'timeout') {
          userMessage = 'El servidor tardó demasiado en responder. Recargá la página e intentá nuevamente.';
        } else if (err.name === 'AbortError') {
          userMessage = 'La conexión se canceló. Recargá la página e intentá nuevamente.';
        } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
          userMessage = 'No se pudo conectar al servidor. Verificá tu conexión o recargá la página.';
        } else {
          userMessage = err.message || userMessage;
        }
        showLoginError(errorEl, userMessage);
        showToast(userMessage, 'error');
      } finally {
        btn.textContent = 'Ingresar';
        btn.disabled = false;
      }
    }

    function showLoginError(errorEl, message) {
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
    }

    function clearLoginError(errorEl) {
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    }

    async function doLogout() {
      try {
        await fetch(getApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
      } catch (e) {
        console.warn('[doLogout] Error cerrando sesión:', e);
      }
      authToken = '';
      document.getElementById('loginOverlay').classList.remove('hidden');
      showToast('Sesión cerrada', 'default');
    }

      async function adminFetch(url, opts = {}, isRetry = false) {
        if (!authToken) throw new Error('No autorizado');
        const headers = { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) };
        const fullUrl = url.startsWith('/api/') ? `${CONFIG.API.BASE}${url}` : url;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const isFormData = opts.body instanceof FormData;
          let finalHeaders = headers;
          if (isFormData) {
            /* eslint-disable-next-line no-unused-vars */
            const { 'Content-Type': _ct, ...rest } = headers;
            finalHeaders = rest;
          }
          const res = await fetch(fullUrl, { ...opts, headers: finalHeaders, signal: controller.signal, credentials: 'include' });
         clearTimeout(timeout);
          if (res.status === 401 && !isRetry) {
            try {
              const refreshRes = await fetch(getApiUrl('/api/auth/refresh'), {
                method: 'POST',
                credentials: 'include'
              });
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                authToken = refreshData.token;
                return adminFetch(url, opts, true);
              }
             } catch (e) {
               console.warn('[adminFetch] Error refrescando token:', e);
             }
            authToken = '';
            document.getElementById('loginOverlay').classList.remove('hidden');
            throw new Error('Sesión expirada. Iniciá sesión nuevamente.');
          }
          if (res.status === 401) {
            authToken = '';
            document.getElementById('loginOverlay').classList.remove('hidden');
            throw new Error('Sesión expirada. Iniciá sesión nuevamente.');
          }
         if (res.status === 403) {
           throw new Error('Acceso denegado. No tenés permisos para esta acción.');
         }
         if (!res.ok) {
           let errorMsg = res.statusText;
           const contentType = res.headers.get('content-type') || '';
           if (contentType.includes('application/json')) {
             const data = await res.json().catch(() => null);
             errorMsg = (data && data.error) || data?.message || errorMsg;
           } else {
             errorMsg = await res.text().catch(() => res.statusText);
           }
           throw new Error(errorMsg || `Error ${res.status}`);
         }
         return res;
       } catch (err) {
         clearTimeout(timeout);
         if (err.name === 'AbortError') {
           console.error('[adminFetch] Timeout:', fullUrl);
           throw new Error('El servidor no respondió en el tiempo esperado. Verificá tu conexión e intentá nuevamente.');
         }
         if (err.message === 'Failed to fetch' || err.message?.includes('fetch')) {
           console.error('[adminFetch] Network error:', fullUrl);
           throw new Error('No se pudo conectar al servidor. Verificá tu conexión e intentá recargar la página.');
         }
         console.error('[adminFetch] Error:', err.message, 'URL:', fullUrl);
         throw err;
       }
     }

     function showToast(message, type = 'default') {
       // Delegate to window.showToast (defined in ui.js) which uses (icon, message, type)
       if (typeof window.showToast === 'function') {
         return window.showToast('', message, type);
       }
       const container = document.getElementById('toastContainer');
       if (!container) return;
       const toast = document.createElement('div');
       toast.className = `toast ${type}`;
       toast.textContent = message;
       container.appendChild(toast);
       setTimeout(() => toast.remove(), 3500);
     }

    function showSaveStatus(elementId, status, message) {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.textContent = message;
      el.className = 'save-status visible ' + status;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }

    function hideSaveStatus(elementId, fadeOut = true) {
      const el = document.getElementById(elementId);
      if (!el) return;
      if (fadeOut) {
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-4px)';
        setTimeout(() => {
          el.className = 'save-status';
          el.textContent = '';
        }, 300);
      } else {
        el.className = 'save-status';
        el.textContent = '';
      }
    }

    function clearSaveStatus(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.className = 'save-status';
      el.textContent = '';
    }
    function updateConnectionIndicator(status) {
      const el = document.getElementById('connectionIndicator');
      if (!el) return;
      const textEl = el.querySelector('.connection-text');
      el.classList.remove('connected', 'error', 'offline', 'checking');
      if (status.backend === 'connected') {
        el.classList.add('connected');
        textEl.textContent = 'Conectado';
      } else if (status.backend === 'offline') {
        el.classList.add('offline');
        textEl.textContent = 'Sin conexión';
      } else if (status.backend === 'error') {
        el.classList.add('error');
        textEl.textContent = 'Error';
      } else {
        el.classList.add('checking');
        textEl.textContent = 'Reconectando...';
      }
    }

    if (window.Connection) {
      window.Connection.subscribe(updateConnectionIndicator);
      window.Connection.startMonitoring();
    }

    let autosaveTimer = null;
    const autosaveFields = ['pName', 'pCategory', 'pPrice', 'pDesc'];
    const autosaveIndicator = document.getElementById('autosaveIndicator');

    function showAutosave(status, message) {
      if (!autosaveIndicator) return;
      autosaveIndicator.style.display = 'inline-flex';
      autosaveIndicator.className = 'autosave-indicator ' + status;
      autosaveIndicator.textContent = message;
    }

    autosaveFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (autosaveIndicator) showAutosave('saving', 'Guardando...');
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
          const name = document.getElementById('pName')?.value.trim();
          const price = Number(document.getElementById('pPrice')?.value);
          if (name && price) {
            showAutosave('saved', 'Guardado');
            setTimeout(() => { if (autosaveIndicator) autosaveIndicator.style.display = 'none'; }, 2000);
          } else {
            showAutosave('error', 'Faltan datos');
            setTimeout(() => { if (autosaveIndicator) autosaveIndicator.style.display = 'none'; }, 3000);
          }
        }, 2000);
      });
    });

    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('connectionIndicator')) {
        updateConnectionIndicator(window.Connection?.getStatus?.() || { backend: 'checking' });
      }
      setTimeout(checkServerHealth, 800);
    });

    const state = { currentCategoryId: null, currentOrderId: null, currentCustomerId: null, dashboardLoaded: false };

     let deleteOrderState = { id: null, orderNumber: null, customer: null };

function openSectionModal() {
        if (currentSection === 'products') openModal();
        if (currentSection === 'categories') openCategoryModal();
        if (currentSection === 'testimonials') openTestimonialModal();
        if (currentSection === 'texts') openTextModal();
        if (currentSection === 'heroImages') openHeroSlotModal(0);
      }

async function loadCategories() {
        try {
          const res = await adminFetch('/api/admin/categories');
          categories = await res.json();
        const productsRes = await adminFetch('/api/admin/products');
          const productData = await productsRes.json();
          const allProducts = productData.products || productData || [];
          const tbody = document.getElementById('categoriesTableBody');
          if (!tbody) return;
          if (!categories.length) { tbody.innerHTML = '<tr><td colspan=\'7\' class=\'empty-state\'>Sin categorías</td></tr>'; return; }
          tbody.innerHTML = categories.map(c => {
            const productCount = allProducts.filter(p => p.category === c.name).length;
            return `<tr>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td><code>${escapeHtml(c.slug)}</code></td>
              <td>${escapeHtml(c.description || '')}</td>
              <td><span class='badge'>${productCount} producto${productCount !== 1 ? 's' : ''}</span></td>
              <td>${c.active ? '✅ Activo' : '❌ Inactivo'}</td>
              <td>${c.orden}</td>
              <td><div class='actions'><button class='btn btn-secondary btn-sm' onclick='editCategory(${c.id})'>✏️</button><button class='btn btn-danger btn-sm' onclick='deleteCategory(${c.id}, ${productCount})'>🗑</button></div></td>
            </tr>`;
          }).join('');
        } catch (err) {
          console.error('[loadCategories] Error:', err);
          const msg = err.message.includes('conectar') || err.message.includes('Timeout') || err.message.includes('tiempo')
            ? '❌ No se pudo conectar al servidor. Verificá tu conexión o recargá.'
            : '❌ Error al cargar las categorías. ' + err.message;
          document.getElementById('categoriesTableBody').innerHTML = `<tr><td colspan='7' class='empty-state'>${escapeHtml(msg)}</td></tr>`;
        }
      }

    function openCategoryModal(cat = null) {
      state.currentCategoryId = cat ? cat.id : null;
      document.getElementById('categoryModalTitle').textContent = cat ? 'Editar Categoría' : 'Nueva Categoría';
      clearSaveStatus('categorySaveStatus');
      document.getElementById('catName').value = cat ? cat.name : '';
      document.getElementById('catSlug').value = cat ? cat.slug : '';
      document.getElementById('catDescription').value = cat ? (cat.description || '') : '';
      document.getElementById('catOrden').value = cat ? cat.orden : 0;
      document.getElementById('catActive').value = cat ? String(cat.active) : 'true';
      document.getElementById('catImage').value = cat ? (cat.image || '') : '';
      document.getElementById('catImageFile').value = '';
      const imgPreview = document.getElementById('catImagePreview');
      if (cat && cat.image) {
        imgPreview.style.display = 'block';
         imgPreview.innerHTML = window.renderProductImage(cat.image || '', 'Preview', { style: 'max-height:80px;' });
      } else {
        imgPreview.style.display = 'none';
        imgPreview.innerHTML = '';
      }
      const overlay = document.getElementById('categoryModalOverlay');
      overlay.classList.add('active');
      openModalScrollLock(overlay, closeCategoryModal);
    }

    function closeCategoryModal() {
      document.getElementById('categoryModalOverlay').classList.remove('active');
      unlockModalScroll();
      state.currentCategoryId = null;
      clearSaveStatus('categorySaveStatus');
    }

    async function saveCategory() {
      const name = document.getElementById('catName').value.trim();
      const slug = document.getElementById('catSlug').value.trim();
      const description = document.getElementById('catDescription').value.trim();
      const orden = Number(document.getElementById('catOrden').value) || 0;
      const active = document.getElementById('catActive').value === 'true';
      const imageFile = document.getElementById('catImageFile').files[0];
      const existingImage = document.getElementById('catImage').value;
      if (!name || !slug) { showSaveStatus('categorySaveStatus', 'error', '❌ Nombre y slug son obligatorios'); return; }
      try {
        showSaveStatus('categorySaveStatus', 'saving', 'Guardando...');
        const url = state.currentCategoryId ? `/api/admin/categories/${state.currentCategoryId}` : '/api/admin/categories';
        const method = state.currentCategoryId ? 'PUT' : 'POST';
        if (imageFile) {
          const formData = new FormData();
          formData.append('name', name);
          formData.append('slug', slug);
          formData.append('description', description);
          formData.append('orden', orden);
          formData.append('active', active);
          formData.append('image', imageFile);
          await adminFetch(url, { method, body: formData });
        } else {
          const payload = { name, slug, description, active, orden, image: existingImage };
          await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        }
        showSaveStatus('categorySaveStatus', 'success', '✅ Guardado');
        await loadCategories();
        setTimeout(() => { hideSaveStatus('categorySaveStatus'); closeCategoryModal(); }, 1500);
      } catch (err) {
        showSaveStatus('categorySaveStatus', 'error', '❌ ' + err.message);
        setTimeout(() => hideSaveStatus('categorySaveStatus'), 3000);
      }
    }

    function editCategory(id) {
      const cat = categories.find(c => c.id === id);
      if (cat) openCategoryModal(cat);
    }

async function deleteCategory(id, productCount = 0) {
       if (productCount > 0) {
         if (!confirm(`Esta categoría tiene ${productCount} producto${productCount !== 1 ? 's' : ''} asociado${productCount !== 1 ? 's' : ''}. ¿Eliminarla de todos modos? Los productos quedarán sin categoría.`)) return;
       } else {
         if (!confirm('¿Eliminar categoría?')) return;
       }
       try {
         await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
         showToast('Categoría eliminada', 'success');
         await loadCategories();
       } catch (err) {
         showToast(err.message, 'error');
       }
     }

async function loadProducts() {
      try {
        const res = await adminFetch('/api/admin/products');
        const data = await res.json();
        products = data.products || data || [];
        renderProductsTable();
      } catch (err) {
        console.error('[loadProducts] Error:', err);
        const msg = err.message.includes('conectar') || err.message.includes('Timeout') || err.message.includes('tiempo')
          ? '❌ No se pudo conectar al servidor. Verificá tu conexión o recargá.'
          : '❌ Error al cargar los productos. ' + err.message;
         document.getElementById('tableBody').innerHTML = `<tr><td colspan='9' class='empty-state'>${escapeHtml(msg)}</td></tr>`;
      }
    }

function renderProductsTable() {
       const q = (document.getElementById('productSearchInput')?.value || '').toLowerCase();
       const category = document.getElementById('categoryFilter')?.value || '';
       const filtered = products.filter(p => {
         const matchesSearch = (p.name + ' ' + (p.description || '') + ' ' + p.category + ' ' + (p.sku || '')).toLowerCase().includes(q);
         const matchesCategory = !category || p.category === category;
         return matchesSearch && matchesCategory;
       });
       const tbody = document.getElementById('tableBody');
       if (filtered.length === 0) {
          tbody.innerHTML = '<tr><td colspan=\'9\' class=\'empty-state\'><h3>Sin resultados</h3><p>No se encontraron productos.</p></td></tr>';
         return;
       }
        tbody.innerHTML = filtered.map(p => `<tr>
          <td><code>${escapeHtml(p.slug || '—')}</code></td>
           <td><div class='product-cell'><div class='thumb'>${(() => { const imgUrl = window.getProductImageUrl(p) || ''; return imgUrl ? window.renderProductImage(imgUrl, p.name, { placeholder: p.emoji || '📿' }) : (p.emoji || '📿'); })()}</div><div><div class='product-name'>${escapeHtml(p.name)}</div><div class='product-desc'>${escapeHtml(p.description || '')}</div></div></div></td>          <td><span class='badge badge-${escapeHtml(p.category)}'>${escapeHtml(p.category)}</span></td>
          <td><code>${escapeHtml(p.sku || '—')}</code></td>
          <td><span class='price-cell'>$${Number(p.price).toLocaleString('es-AR')}</span></td>
          <td><span class='badge badge-stock ${p.stock > 0 ? 'badge-stock--ok' : 'badge-stock--out'}'>${p.stock > 0 ? `✅ ${p.stock}` : '❌ Sin stock'}</span></td>
           <td>${(() => { const imgUrl = window.getProductImageUrl(p) || ''; return imgUrl ? `<div class='thumb'>${window.renderProductImage(imgUrl, p.name, { placeholder: p.emoji || '📿' })}</div>` : `<div class='thumb'>${p.emoji || '📿'}</div>`; })()}</td>
          <td><button class='btn btn-${p.active !== false ? 'secondary' : 'secondary'} btn-sm' onclick='toggleProductStatus(${p.id})'>${p.active !== false ? '✅ Activo' : '❌ Inactivo'}</button></td>
          <td><div class='actions'>
            <button class='btn btn-secondary btn-sm' onclick='editProduct(${p.id})'>✏️ Editar</button>
            <button class='btn btn-secondary btn-sm' onclick='duplicateProduct(${p.id})' title='Duplicar'>📋</button>
            <button class='btn btn-danger btn-sm' onclick='deleteProduct(${p.id})'>🗑</button>
          </div></td>
        </tr>`).join('');
     }

     /* eslint-disable-next-line no-unused-vars */
     function editProduct(id) {
      const p = products.find(x => x.id === id);
      if (p) openModal(p);
    }

      /* eslint-disable-next-line no-unused-vars */
      async function deleteProduct(id) {
       if (!confirm('¿Eliminar producto?')) return;
       try {
         await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
          showToast('Producto eliminado', 'success');
          await loadProducts();
          emitSync('products_updated');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }

     /* eslint-disable-next-line no-unused-vars */
      async function toggleProductStatus(id) {
         const product = products.find(p => p.id === id);
         if (!product) return;
         try {
           await adminFetch(`/api/admin/products/${id}/estado`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ active: product.active !== false ? false : true })
           });
           showToast('Estado actualizado', 'success');
           await loadProducts();
           emitSync('products_updated');
         } catch (err) {
           showToast(err.message, 'error');
         }
      }

      /* eslint-disable-next-line no-unused-vars */
      async function duplicateProduct(id) {
         const product = products.find(p => p.id === id);
         if (!product) return;
         if (!confirm(`¿Duplicar "${product.name}"?`)) return;
         try {
           await adminFetch(`/api/admin/products/${id}/duplicar`, { method: 'POST' });
           showToast('Producto duplicado', 'success');
           await loadProducts();
           emitSync('products_updated');
         } catch (err) {
           showToast(err.message, 'error');
         }
       }

     async function saveProduct() {
        const name = document.getElementById('pName').value.trim();
        const category = document.getElementById('pCategory').value;
        const price = Number(document.getElementById('pPrice').value);
        const stock = Number(document.getElementById('pStock').value) || 0;
        const sku = document.getElementById('pSku').value.trim();
        const description = document.getElementById('pDesc').value.trim();
        const featured = document.getElementById('pFeatured').checked;
        const active = document.getElementById('pActive').checked;
        if (!name || !price) { showSaveStatus('productSaveStatus', 'error', '❌ Nombre y precio son requeridos'); return; }
        if (price <= 0) { showSaveStatus('productSaveStatus', 'error', '❌ El precio debe ser mayor a 0'); return; }
        if (stock < 0) { showSaveStatus('productSaveStatus', 'error', '❌ El stock no puede ser negativo'); return; }
        const payload = { name, category, price, stock, sku, description, featured, active };
        try {
          showSaveStatus('productSaveStatus', 'saving', 'Guardando producto...');
          const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
          const method = editingId ? 'PUT' : 'POST';
          const res = await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const savedProduct = await res.json();
          if (!editingId && savedProduct.id) {
            editingId = savedProduct.id;
            document.getElementById('pId').value = savedProduct.id;
          }
          // Subir imágenes pendientes (producto nuevo o editado) después de guardar el producto
          if (window.ProductImages && window.ProductImages.hasPendingFiles && window.ProductImages.hasPendingFiles()) {
            showSaveStatus('productSaveStatus', 'saving', 'Guardando producto y subiendo imágenes...');
            const uploaded = await window.ProductImages.uploadPending(savedProduct.id || editingId);
            if (uploaded > 0) {
              showToast(`${uploaded} imagen(es) subida(s)`, 'success');
            }
          }
          showSaveStatus('productSaveStatus', 'success', '✅ Guardado correctamente');
           await loadProducts();
           emitSync('products_updated');
           setTimeout(() => {
            if (window.ProductImages && editingId) {
              window.ProductImages.init(editingId);
            }
            hideSaveStatus('productSaveStatus');
            closeModal();
          }, 1500);
        } catch (err) {
          showSaveStatus('productSaveStatus', 'error', '❌ Error al guardar: ' + err.message);
          setTimeout(() => hideSaveStatus('productSaveStatus'), 5000);
        }
      }

function openModal(product = null) {
       editingId = product ? product.id : null;
       document.getElementById('modalTitle').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
       clearSaveStatus('productSaveStatus');
       document.getElementById('pName').value = product ? product.name : '';
       document.getElementById('pCategory').value = product ? product.category : 'pulseras';
       document.getElementById('pPrice').value = product ? product.price : '';
       document.getElementById('pStock').value = product ? product.stock : '';
       document.getElementById('pSku').value = product ? (product.sku || '') : '';
       document.getElementById('pDesc').value = product ? (product.description || '') : '';
       document.getElementById('pFeatured').checked = product ? product.featured : false;
       document.getElementById('pActive').checked = product ? product.active !== false : true;
    document.getElementById('pImage').value = product ? (product.image || '') : '';
       document.getElementById('pId').value = product ? product.id : '';
       const overlay = document.getElementById('modalOverlay');
       overlay.classList.add('active');
       openModalScrollLock(overlay, closeModal);
       setTimeout(() => {
         if (window.ProductImages) {
           window.ProductImages.init(product ? product.id : null);
         }
       }, 100);
       const firstInput = overlay.querySelector('input, select, textarea, button');
       if (firstInput) firstInput.focus();
     }

      function closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        unlockModalScroll();
        editingId = null;
        clearSaveStatus('productSaveStatus');
      }

     /* eslint-disable-next-line no-unused-vars */
     function getAuthToken() {
       return authToken;
     }

function setReportPreset(preset) {
       const now = new Date();
       let start, end;
       switch (preset) {
         case 'today':
           start = end = now.toISOString().split('T')[0];
           break;
         case '7d':
           start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
           end = new Date().toISOString().split('T')[0];
           break;
         case '30d':
           start = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
           end = new Date().toISOString().split('T')[0];
           break;
         case 'month':
           start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
           end = now.toISOString().split('T')[0];
           break;
         default:
           return;
       }
       document.getElementById('reportStartDate').value = start;
       document.getElementById('reportEndDate').value = end;
       loadSalesReport();
     }

     let salesChartInstance = null;
     let trendChartInstance = null;

     async function loadSalesReport() {
       const start = document.getElementById('reportStartDate').value;
       const end = document.getElementById('reportEndDate').value;
       const params = new URLSearchParams();
       if (start) params.set('start_date', start);
       if (end) params.set('end_date', end);
       try {
         const res = await adminFetch(`/api/admin/reports/sales?${params.toString()}`);
         const data = await res.json();
         const metricsEl = document.getElementById('reportMetrics');
         const container = document.getElementById('reportContent');
         if (!container) return;
         const fmt = n => '$' + Number(n).toLocaleString('es-AR');
         if (metricsEl) {
            metricsEl.innerHTML = `<div class='metrics-grid'>
              <div class='metric-card'><div class='metric-value'>${fmt(data.sales.total)}</div><div class='metric-label'>Ventas totales</div></div>
              <div class='metric-card'><div class='metric-value'>${data.sales.count}</div><div class='metric-label'>Pedidos</div></div>
              <div class='metric-card'><div class='metric-value'>${fmt(data.ticketPromedio)}</div><div class='metric-label'>Ticket promedio</div></div>
              <div class='metric-card'><div class='metric-value'>${(data.byProduct || []).length}</div><div class='metric-label'>Productos vendidos</div></div>
              <div class='metric-card'><div class='metric-value'>${(data.byCategory || []).length}</div><div class='metric-label'>Categorías</div></div>
            </div>`;
         }
         container.innerHTML = `<div class='report-section'>
           <h4>Por producto</h4>
           <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>
              ${(data.byProduct || []).map(p => `<tr><td>${escapeHtml(p.name || '')}</td><td>${p.qty}</td><td>${fmt(p.total)}</td></tr>`).join('')}
           </tbody></table>
           <h4>Por categoría</h4>
           <table><thead><tr><th>Categoría</th><th>Total</th><th>Pedidos</th></tr></thead><tbody>
              ${(data.byCategory || []).map(c => `<tr><td>${escapeHtml(c.category || '')}</td><td>${fmt(c.total)}</td><td>${c.orders}</td></tr>`).join('')}
           </tbody></table>
           <h4>Por estado</h4>
           <table><thead><tr><th>Estado</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>
              ${(data.byStatus || []).map(s => `<tr><td>${escapeHtml(s.status || '')}</td><td>${s.count}</td><td>${fmt(s.total)}</td></tr>`).join('')}
           </tbody></table>
         </div>`;
         renderSalesChart(data);
       } catch (err) {
         console.error('[loadSalesReport] Error:', err);
         document.getElementById('reportContent').innerHTML = '<div class=\'empty-state\'>Error al cargar los datos. Verificá la consola para más detalles.</div>';
       }
     }

     function renderSalesChart(data) {
       const canvas = document.getElementById('salesChart');
       if (!canvas) return;
       const ctx = canvas.getContext('2d');
       if (salesChartInstance) salesChartInstance.destroy();
       const colors = ['#d47090', '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
       salesChartInstance = new Chart(ctx, {
         type: 'bar',
         data: {
           labels: (data.byCategory || []).map(c => c.category),
           datasets: [{
             label: 'Ventas ($)',
             data: (data.byCategory || []).map(c => c.total),
             backgroundColor: (data.byCategory || []).map((_, i) => colors[i % colors.length] + '80'),
             borderColor: (data.byCategory || []).map((_, i) => colors[i % colors.length]),
             borderWidth: 1,
             borderRadius: 6,
           }]
         },
         options: {
           responsive: true,
           maintainAspectRatio: false,
           plugins: { legend: { display: false } },
           scales: {
             y: { beginAtZero: true, ticks: { callback: v => '$' + Number(v).toLocaleString('es-AR') } }
           }
         }
       });
     }

     async function loadSalesTrend() {
       const days = 7;
       try {
         const res = await adminFetch(`/api/admin/reports/trend?days=${days}`);
         const data = await res.json();
         const container = document.getElementById('trendContent');
         const canvas = document.getElementById('trendChart');
         if (!container) return;
         if (!data.length) {
           container.innerHTML = '<div class=\'empty-state\'>Sin datos de tendencia</div>';
           if (canvas) canvas.style.display = 'none';
           return;
         }
         if (canvas) canvas.style.display = 'block';
         const fmt = n => '$' + Number(n).toLocaleString('es-AR');
         container.innerHTML = `<div class='report-section'>
           <h4>Tendencia de ventas (últimos ${days} días)</h4>
           <table><thead><tr><th>Fecha</th><th>Total</th><th>Pedidos</th></tr></thead><tbody>
              ${data.map(r => `<tr><td>${escapeHtml(r.date || '')}</td><td>${fmt(r.total)}</td><td>${r.count}</td></tr>`).join('')}
           </tbody></table>
         </div>`;
         renderTrendChart(data);
       } catch (err) {
         console.error('[loadSalesTrend] Error:', err);
         document.getElementById('trendContent').innerHTML = '<div class=\'empty-state\'>Error al cargar la tendencia.</div>';
       }
     }

     function renderTrendChart(data) {
       const canvas = document.getElementById('trendChart');
       if (!canvas) return;
       const ctx = canvas.getContext('2d');
       if (trendChartInstance) trendChartInstance.destroy();
       trendChartInstance = new Chart(ctx, {
         type: 'line',
         data: {
           labels: data.map(r => r.date),
           datasets: [{
             label: 'Ventas ($)',
             data: data.map(r => r.total),
             borderColor: '#d47090',
             backgroundColor: '#d4709020',
             fill: true,
             tension: 0.3,
             pointBackgroundColor: '#d47090',
           }, {
             label: 'Pedidos',
             data: data.map(r => r.count),
             borderColor: '#6366f1',
             backgroundColor: '#6366f120',
             fill: true,
             tension: 0.3,
             pointBackgroundColor: '#6366f1',
             yAxisID: 'y1',
           }]
         },
         options: {
           responsive: true,
           maintainAspectRatio: false,
           interaction: { mode: 'index', intersect: false },
           plugins: { legend: { position: 'bottom' } },
           scales: {
             y: { beginAtZero: true, ticks: { callback: v => '$' + Number(v).toLocaleString('es-AR') }, title: { display: true, text: 'Ventas' } },
             y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Pedidos' } }
           }
         }
       });
     }

    function togglePasswordSection() {
      const el = document.getElementById('passwordSection');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    async function changePassword() {
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      if (!currentPassword || !newPassword) {
        showSaveStatus('passwordSaveStatus', 'error', '❌ Completá ambos campos');
        return;
      }
      if (newPassword.length < 6) {
        showSaveStatus('passwordSaveStatus', 'error', '❌ La nueva contraseña debe tener al menos 6 caracteres');
        return;
      }
      try {
        showSaveStatus('passwordSaveStatus', 'saving', 'Guardando...');
        const res = await adminFetch('/api/admin/change-password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        showSaveStatus('passwordSaveStatus', 'success', '✅ Contraseña actualizada');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        setTimeout(() => hideSaveStatus('passwordSaveStatus'), 3000);
      } catch (err) {
        showSaveStatus('passwordSaveStatus', 'error', '❌ ' + err.message);
        setTimeout(() => hideSaveStatus('passwordSaveStatus'), 3000);
      }
    }

     /* eslint-disable-next-line no-unused-vars */
     async function handleBulkImport(input) {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const statusEl = document.getElementById('bulkImportStatus');
      try {
        statusEl.textContent = 'Importando...';
        statusEl.style.color = '#334155';
        const res = await adminFetch('/api/admin/products/bulk-import', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al importar');
        statusEl.textContent = `Importado: ${data.success} ok, ${data.errors} errores`;
        statusEl.style.color = data.errors > 0 ? '#f59e0b' : '#10b981';
        showToast(`Carga masiva: ${data.success} productos importados`, 'success');
        await loadProducts();
      } catch (err) {
        statusEl.textContent = 'Error';
        statusEl.style.color = '#dc2626';
        showToast(err.message, 'error');
      } finally {
        input.value = '';
      }
    }

    async function generateReceipt(id) {
      try {
        const res = await adminFetch(`/api/admin/orders/${id}/receipt`, {
          method: 'GET'
        });
        if (!res.ok) throw new Error('Error al generar comprobante');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-pedido-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Comprobante descargado', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function sendReceiptWhatsApp(id) {
      try {
        const res = await adminFetch(`/api/admin/orders/${id}/receipt/whatsapp`, {
          method: 'POST'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al enviar');
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, '_blank');
        }
        showToast('Abriendo WhatsApp...', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

      async function loadOrders() {
        try {
          const params = new URLSearchParams();
         params.set('page', ordersCurrentPage);
         params.set('limit', 15);
         params.set('sort_by', 'created_at');
         params.set('sort_order', 'desc');
          const statusFilter = document.getElementById('orderStatusFilter')?.value;
          if (statusFilter) params.set('status', statusFilter);
          const res = await adminFetch(`/api/admin/orders?${params.toString()}`);
         const data = await res.json();
          orders = data.orders || data || [];
         ordersTotalPages = data.pagination?.totalPages || data.pages || 1;
          const pageInfo = document.getElementById('orderPageInfo');
          if (pageInfo) pageInfo.textContent = `Página ${ordersCurrentPage} de ${ordersTotalPages}`;
          const pagination = document.getElementById('ordersPagination');
         if (pagination) {
           pagination.style.display = ordersTotalPages > 1 ? 'flex' : 'none';
         }
          renderOrdersTable();
        } catch (err) {
          console.error('[loadOrders] Error:', err);
          document.getElementById('ordersTableBody').innerHTML = '<tr><td colspan=\'7\' class=\'empty-state\'>Error al cargar los datos. Verificá la consola para más detalles.</td></tr>';
        }
      }

function renderOrdersTable() {
        const q = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('orderStatusFilter')?.value || '';
        const dateFrom = document.getElementById('orderDateFrom')?.value || '';
        const dateTo = document.getElementById('orderDateTo')?.value || '';
        const filtered = orders.filter(o => {
          const customerName = (typeof o.customer === 'string' ? safeJsonParse(o.customer, {}) : (o.customer || {})).name || '';
          const matchesSearch = customerName.toLowerCase().includes(q) || String(o.id).includes(q);
          const matchesStatus = !statusFilter || o.status === statusFilter;
          const orderDate = o.created_at ? o.created_at.split('T')[0] : '';
          const matchesDateFrom = !dateFrom || orderDate >= dateFrom;
          const matchesDateTo = !dateTo || orderDate <= dateTo;
          return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
        });
        const tbody = document.getElementById('ordersTableBody');
        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan=\'8\' class=\'empty-state\'><h3>Sin resultados</h3><p>No se encontraron pedidos.</p></td></tr>';
          return;
        }
           tbody.innerHTML = filtered.map((o, index) => {
              const customer = typeof o.customer === 'string' ? safeJsonParse(o.customer, {}) : (o.customer || {});
            return `<tr>
              <td><strong>#${o.id}</strong></td>
             <td>${escapeHtml(customer.name || '—')}</td>
             <td><span class='price-cell'>$${Number(o.total).toLocaleString('es-AR')}</span></td>
              <td><span class='badge badge-${o.status === 'delivered' || o.status === 'completed' ? 'stock--ok' : (o.status === 'cancelled' ? 'stock--out' : '')}'>${escapeHtml(o.status || 'pending')}</span></td>
              <td>${escapeHtml(o.payment_method || '—')}</td>
             <td>${new Date(o.created_at).toLocaleDateString('es-AR')}</td>
             <td><div class='actions'>
              <button class='btn btn-secondary btn-sm' onclick='viewOrder(${o.id})'>👁 Ver</button>
              <button class='btn btn-danger btn-sm' onclick='openDeleteOrderModal(${o.id}, ${index + 1})' title='Eliminar pedido'>🗑</button>
              <select class='status-select' onchange='quickUpdateOrderStatus(${o.id}, this.value)' style='margin-left:0.25rem'>
               <option value='pending' ${o.status === 'pending' ? 'selected' : ''}>⏳</option>
               <option value='confirmed' ${o.status === 'confirmed' ? 'selected' : ''}>✅</option>
               <option value='preparing' ${o.status === 'preparing' ? 'selected' : ''}>👨‍🍳</option>
               <option value='shipped' ${o.status === 'shipped' ? 'selected' : ''}>🚚</option>
               <option value='delivered' ${o.status === 'delivered' ? 'selected' : ''}>📦</option>
               <option value='cancelled' ${o.status === 'cancelled' ? 'selected' : ''}>❌</option>
             </select>
            </div></td>
            </tr>`;
          }).join('');
          renderPagination('ordersPagination', ordersCurrentPage, ordersTotalPages, loadOrders);
        }

      function renderPagination(containerId, currentPage, totalPages, onChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (totalPages <= 1) { container.style.display = 'none'; return; }
        container.style.display = 'flex';
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
        if (start > 1) pages.push(1);
        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('...');
        if (end < totalPages) pages.push(totalPages);
        container.innerHTML = `<button class='btn btn-secondary btn-sm' onclick='${onChange.name || onChange}(${1})' ${currentPage === 1 ? 'disabled' : ''}>« Primero</button>` +
          pages.map(p => p === '...' ? '<span class=\'page-ellipsis\'>…</span>' :
            `<button class='btn btn-${currentPage === p ? 'primary' : 'secondary'} btn-sm' onclick='${onChange.name || onChange}(${p})'>${p}</button>`).join('') +
          `<button class='btn btn-secondary btn-sm' onclick='${onChange.name || onChange}(${totalPages})' ${currentPage === totalPages ? 'disabled' : ''}>Último »</button>`;
      }

      async function quickUpdateOrderStatus(id, newStatus) {
         if (!newStatus) return;
         try {
           await adminFetch(`/api/admin/orders/${id}/status`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ status: newStatus })
           });
           showToast('Estado actualizado', 'success');
           await loadOrders();
           emitSync('order_status_updated');
         } catch (err) {
           showToast(err.message, 'error');
         }
      }

      function openDeleteOrderModal(realId, orderNumber) {
         const order = orders.find(o => o.id === realId);
         const customer = order ? (typeof order.customer === 'string' ? safeJsonParse(order.customer, {}) : (order.customer || {})) : {};
         const customerName = customer.name || '—';
         deleteOrderState = { id: realId, orderNumber: orderNumber, customer: customerName };
         const msg = document.getElementById('deleteOrderModalMessage');
         if (msg) msg.textContent = `¿Eliminar el pedido #${orderNumber} de ${customerName}? Esta acción no se puede deshacer.`;
         const btn = document.getElementById('confirmDeleteOrderBtn');
         if (btn) { btn.disabled = false; btn.textContent = 'Eliminar'; }
         const overlay = document.getElementById('deleteOrderModalOverlay');
         overlay.classList.add('active');
         openModalScrollLock(overlay, closeDeleteOrderModal);
       }

      function closeDeleteOrderModal() {
         const overlay = document.getElementById('deleteOrderModalOverlay');
         if (overlay) {
           overlay.classList.remove('active');
           unlockModalScroll();
         }
         deleteOrderState = { id: null, orderNumber: null, customer: null };
       }

      async function confirmDeleteOrder() {
         const { id, orderNumber } = deleteOrderState;
         if (!id) return;
         const btn = document.getElementById('confirmDeleteOrderBtn');
         if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }
         try {
           const res = await adminFetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
           const data = await res.json();
           if (!res.ok) throw new Error(data.error || 'Error al eliminar el pedido');
           orders = orders.filter(o => o.id !== id);
           closeDeleteOrderModal();
           if (currentSection === 'orders') {
             if (orders.length === 0 && ordersCurrentPage > 1) {
               ordersCurrentPage--;
               await loadOrders();
             } else {
               renderOrdersTable();
             }
           }
           showToast(`Pedido #${orderNumber} eliminado correctamente`, 'success');
         } catch (err) {
           showToast(err.message, 'error');
         } finally {
           if (btn) { btn.disabled = false; btn.textContent = 'Eliminar'; }
         }
       }

        async function exportOrdersCSV() {
         const params = new URLSearchParams();
         const statusFilter = document.getElementById('orderStatusFilter')?.value;
         if (statusFilter) params.set('status', statusFilter);
         params.set('format', 'csv');
         try {
           const res = await adminFetch(`/api/admin/orders/export?${params.toString()}`);
           if (!res.ok) throw new Error('Error al exportar');
           const blob = await res.blob();
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = 'pedidos.csv';
           a.click();
           URL.revokeObjectURL(url);
           showToast('CSV exportado', 'success');
         } catch (err) {
           showToast(err.message, 'error');
         }
       }

       async function exportOrdersPDF() {
         const params = new URLSearchParams();
         const statusFilter = document.getElementById('orderStatusFilter')?.value;
         if (statusFilter) params.set('status', statusFilter);
         params.set('format', 'pdf');
         try {
           const res = await adminFetch(`/api/admin/orders/export?${params.toString()}`);
           if (!res.ok) throw new Error('Error al exportar');
           const blob = await res.blob();
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = 'pedidos.pdf';
           a.click();
           URL.revokeObjectURL(url);
           showToast('PDF exportado', 'success');
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
        console.error('[loadTestimonials] Error:', err);
        document.getElementById('testimonialsTableBody').innerHTML = '<tr><td colspan=\'5\' class=\'empty-state\'>Error al cargar los datos. Verificá la consola para más detalles.</td></tr>';
      }
    }

    function renderTestimonialsTable() {
      const tbody = document.getElementById('testimonialsTableBody');
      if (!testimonials.length) {
        tbody.innerHTML = '<tr><td colspan=\'5\' class=\'empty-state\'>Sin testimonios</td></tr>';
        return;
      }
      tbody.innerHTML = testimonials.map(t => `<tr>
         <td><strong>${escapeHtml(t.name)}</strong></td>
         <td>${escapeHtml(t.comment || '')}</td>
         <td>${'⭐'.repeat(t.rating || 5)}</td>
         <td><input type='number' min='0' value='${t.orden || 0}' onchange='markTestimonialOrdenChanged(${t.id}, this.value)' style='width:60px;padding:4px 6px;font-size:0.85rem;' /></td>
         <td><label class="testimonial-active-toggle">
           <input type="checkbox" ${t.active ? 'checked' : ''} onchange="toggleTestimonialActive(${t.id}, this.checked)">
           <span class="slider"></span>
         </label></td>
         <td><div class='actions'><button class='btn btn-secondary btn-sm' onclick='editTestimonial(${t.id})'>✏️</button><button class='btn btn-danger btn-sm' onclick='deleteTestimonial(${t.id})'>🗑</button></div></td>
        </tr>`).join('');
     }

    let testimonialOrdenChanges = {};

     /* eslint-disable-next-line no-unused-vars */
     function markTestimonialOrdenChanged(id, value) {
      testimonialOrdenChanges[id] = Number(value);
      const saveBtn = document.getElementById('saveTestimonialsBtn');
      if (saveBtn) saveBtn.disabled = false;
    }

     /* eslint-disable-next-line no-unused-vars */
     async function saveTestimonialsChanges() {
      if (Object.keys(testimonialOrdenChanges).length === 0) {
        showToast('No hay cambios para guardar', 'default');
        return;
      }
      const orden = Object.entries(testimonialOrdenChanges).map(([id, ord]) => ({ id: Number(id), orden: ord }));
      try {
        await adminFetch('/api/admin/testimonials/order', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden })
        });
        showToast('Orden actualizado', 'success');
        testimonialOrdenChanges = {};
        document.getElementById('saveTestimonialsBtn').disabled = true;
        await loadTestimonials();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    function openTestimonialModal(testimonial = null) {
      state.currentTestimonialId = testimonial ? testimonial.id : null;
      document.getElementById('testimonialModalTitle').textContent = testimonial ? 'Editar Testimonio' : 'Nuevo Testimonio';
      clearSaveStatus('testimonialSaveStatus');
      document.getElementById('tName').value = testimonial ? testimonial.name : '';
      document.getElementById('tComment').value = testimonial ? testimonial.comment : '';
       document.getElementById('tRating').value = testimonial ? testimonial.rating : 5;
      document.getElementById('tId').value = testimonial ? testimonial.id : '';
      document.getElementById('tImage').value = testimonial ? (testimonial.image || testimonial.avatar || '') : '';
      document.getElementById('tImageFile').value = '';
      const preview = document.getElementById('testimonialImagePreview');
      if (testimonial && (testimonial.image || testimonial.avatar)) {
        preview.style.display = 'block';
         preview.innerHTML = window.renderProductImage(testimonial.image || testimonial.avatar || '', 'Preview', { style: 'max-height:80px;' });
      } else {
        preview.style.display = 'none';
        preview.innerHTML = '';
      }
      const overlay = document.getElementById('testimonialModalOverlay');
      overlay.classList.add('active');
      openModalScrollLock(overlay, closeTestimonialModal);
    }

    function closeTestimonialModal() {
      document.getElementById('testimonialModalOverlay').classList.remove('active');
      unlockModalScroll();
      state.currentTestimonialId = null;
      clearSaveStatus('testimonialSaveStatus');
    }

    async function saveTestimonial() {
      const name = document.getElementById('tName').value.trim();
      const comment = document.getElementById('tComment').value.trim();
      const rating = Number(document.getElementById('tRating').value) || 5;
      const imageFile = document.getElementById('tImageFile').files[0];
      const existingImage = document.getElementById('tImage').value;
      if (!name) { showSaveStatus('testimonialSaveStatus', 'error', '❌ Nombre es requerido'); return; }
      try {
        showSaveStatus('testimonialSaveStatus', 'saving', 'Guardando...');
        const url = state.currentTestimonialId ? `/api/admin/testimonials/${state.currentTestimonialId}` : '/api/admin/testimonials';
        const method = state.currentTestimonialId ? 'PUT' : 'POST';
        if (imageFile) {
          const formData = new FormData();
          formData.append('name', name);
          formData.append('comment', comment);
          formData.append('rating', rating);
          formData.append('active', true);
          formData.append('image', imageFile);
          await adminFetch(url, { method, body: formData });
        } else {
          const payload = { name, comment, rating, active: true, image: existingImage };
          await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        }
        showSaveStatus('testimonialSaveStatus', 'success', '✅ Guardado');
        await loadTestimonials();
        setTimeout(() => { hideSaveStatus('testimonialSaveStatus'); closeTestimonialModal(); }, 1500);
      } catch (err) {
        showSaveStatus('testimonialSaveStatus', 'error', '❌ ' + err.message);
        setTimeout(() => hideSaveStatus('testimonialSaveStatus'), 3000);
      }
    }

    function editTestimonial(id) {
      const t = testimonials.find(x => x.id === id);
      if (t) openTestimonialModal(t);
    }

    async function deleteTestimonial(id) {
      if (!confirm('¿Eliminar testimonio?')) return;
      try {
        await adminFetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
        showToast('Testimonio eliminado', 'success');
        await loadTestimonials();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function toggleTestimonialActive(id, active) {
      try {
         await adminFetch(`/api/admin/testimonials/${id}/active`, {
           method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active })
        });
        showToast('Estado actualizado', 'success');
        await loadTestimonials();
      } catch (err) {
        showToast(err.message, 'error');
        await loadTestimonials();
      }
    }

    async function loadSiteTexts() {
      try {
        const res = await adminFetch('/api/admin/site-texts');
        siteTexts = await res.json();
        renderSiteTextsTable();
      } catch (err) {
        console.error('[loadSiteTexts] Error:', err);
        document.getElementById('textsTableBody').innerHTML = '<tr><td colspan=\'3\' class=\'empty-state\'>Error al cargar los datos. Verificá la consola para más detalles.</td></tr>';
      }
    }

    function renderSiteTextsTable() {
      const tbody = document.getElementById('textsTableBody');
      const entries = Object.entries(siteTexts);
      if (!entries.length) {
        tbody.innerHTML = '<tr><td colspan=\'3\' class=\'empty-state\'>Sin textos</td></tr>';
        return;
      }
      tbody.innerHTML = entries.map(([key, value]) => `<tr>
        <td><code>${escapeHtml(key)}</code></td>
        <td>${escapeHtml(value)}</td>
        <td><button class='btn btn-secondary btn-sm' onclick='editText("${escapeHtml(key)}")'>✏️</button></td>
      </tr>`).join('');
    }

    function openTextModal(text = null) {
      state.currentTextKey = text ? text.key : null;
      document.getElementById('textModalTitle').textContent = text ? 'Editar Texto' : 'Nuevo Texto';
      clearSaveStatus('textSaveStatus');
      document.getElementById('textKey').value = text ? text.key : '';
      document.getElementById('textValue').value = text ? text.value : '';
      const overlay = document.getElementById('textModalOverlay');
      overlay.classList.add('active');
      openModalScrollLock(overlay, closeTextModal);
    }

    function closeTextModal() {
      document.getElementById('textModalOverlay').classList.remove('active');
      unlockModalScroll();
      state.currentTextKey = null;
      clearSaveStatus('textSaveStatus');
    }

    function editText(key) {
      const value = siteTexts[key] || '';
      openTextModal({ key, value });
    }

    async function saveText() {
      const key = document.getElementById('textKey').value.trim();
      const value = document.getElementById('textValue').value.trim();
      if (!key) { showSaveStatus('textSaveStatus', 'error', '❌ Clave es requerida'); return; }
      const payload = { key, value };
      try {
        showSaveStatus('textSaveStatus', 'saving', 'Guardando...');
        const url = state.currentTextKey ? `/api/admin/site-texts/${encodeURIComponent(state.currentTextKey)}` : '/api/admin/site-texts';
        const method = state.currentTextKey ? 'PUT' : 'POST';
        await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showSaveStatus('textSaveStatus', 'success', '✅ Guardado');
        await loadSiteTexts();
        setTimeout(() => { hideSaveStatus('textSaveStatus'); closeTextModal(); }, 1500);
      } catch (err) {
        showSaveStatus('textSaveStatus', 'error', '❌ ' + err.message);
        setTimeout(() => hideSaveStatus('textSaveStatus'), 3000);
      }
    }

async function loadHeroCardsAdmin() {
       try {
         const res = await adminFetch('/api/admin/hero-cards');
         heroCards = await res.json();
         renderHeroSlots();
       } catch (err) {
         console.error('[loadHeroCardsAdmin] Error:', err);
         document.getElementById('heroSlotsList').innerHTML = '<div class=\'empty-state\'>Error al cargar los datos. Verificá la consola para más detalles.</div>';
       }
     }

       function renderHeroSlots() {
          const container = document.getElementById('heroSlotsList');
          if (!container) return;
          const slots = [0, 1];
           const headerIcon = '<svg class="hero-slot-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
           container.innerHTML = `<div class="hero-grid">${slots.map(slotIndex => {
             const card = heroCards.find(c => c.slot === slotIndex) || {};
             const isPrimary = slotIndex === 0;
             const badgeLabel = isPrimary ? 'IMAGEN PRINCIPAL' : 'SECUNDARIA';
             const hasImage = card.imagen || heroPendingFiles[slotIndex];
             const previewContent = card.imagen
               ? window.renderProductImage(card.imagen, 'Slot ' + (slotIndex + 1), { style: 'max-height:100%;width:100%;object-fit:cover;' })
               : '<span class="hero-slot-placeholder-icon">📷</span>';
             return `<div class="hero-slot-card">
               <div class="hero-slot-header">
                 <span class="hero-slot-label">
                    ${headerIcon}
                    Slot ${slotIndex + 1} · Hero
                  </span>
                 <span class="hero-slot-badge">${badgeLabel}</span>
               </div>
                <div class="hero-slot-preview ${card.imagen ? '' : 'placeholder'}" data-slot="${slotIndex}" onclick="document.getElementById('heroSlotImageFile_${slotIndex}').click()">
                  <div class="hero-slot-preview-inner" id="heroSlotPreviewInner_${slotIndex}">
                    ${previewContent}
                  </div>
                  <div class="hero-slot-preview-overlay" aria-hidden="true">
                    <svg class="hero-slot-preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span class="hero-slot-preview-action">Cambiar</span>
                  </div>
                </div>
                <div class="hero-slot-preview-label">Vista previa en el sitio</div>
               <div class="hero-slot-body">
                 <div class="form-group">
                   <label>Título</label>
                   <input type="text" id="heroSlotTitle_${slotIndex}" class="hero-slot-input" value="${escapeHtml(card.titulo || '')}" placeholder="Título del hero" />
                 </div>
                 <div class="form-group">
                   <label>Subtítulo</label>
                   <textarea id="heroSlotSubtitle_${slotIndex}" class="hero-slot-input" rows="3" placeholder="Texto descriptivo">${escapeHtml(card.subtitulo || '')}</textarea>
                 </div>
                 <div class="hero-slot-cta-row">
                   <div class="form-group">
                     <label>Texto del CTA</label>
                     <input type="text" id="heroSlotCtaText_${slotIndex}" class="hero-slot-input" value="${escapeHtml(card.cta_texto || '')}" placeholder="Ej: Ver productos" />
                   </div>
                   <div class="form-group">
                     <label>URL del CTA</label>
                     <input type="text" id="heroSlotCtaUrl_${slotIndex}" class="hero-slot-input" value="${escapeHtml(card.cta_url || '')}" placeholder="Ej: /products" />
                   </div>
                 </div>
                 <div class="hero-slot-image-row">
                   <label class="hero-slot-file-label">
                     <span class="btn btn-secondary btn-sm">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                       Cambiar imagen
                     </span>
                     <input type="file" id="heroSlotImageFile_${slotIndex}" accept="image/jpeg,image/png,image/webp,image/gif" onchange="previewHeroSlotImage(${slotIndex})" />
                   </label>
                   ${hasImage ? `<button class="btn btn-danger btn-sm" onclick="deleteHeroSlotImage(${slotIndex})">🗑 Quitar</button>` : ''}
                 </div>
                  <input type="hidden" id="heroSlotImage_${slotIndex}" value="${card.imagen || ''}" />
                 <div class="hero-slot-footer">
                   <button class="btn btn-primary" onclick="saveHeroSlot(${slotIndex})">💾 Guardar slot</button>
                   <span class="hero-slot-id">Slot ${slotIndex + 1}</span>
                 </div>
               </div>
             </div>`;
           }).join('')}</div>`;
        }

     function previewHeroSlotImage(slotIndex) {
        const fileInput = document.getElementById(`heroSlotImageFile_${slotIndex}`);
        const inner = document.getElementById(`heroSlotPreviewInner_${slotIndex}`);
         const previewEl = document.querySelector(`.hero-slot-preview[data-slot="${slotIndex}"]`);
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
        const file = fileInput.files[0];
        heroPendingFiles[slotIndex] = file;
        const reader = new FileReader();
        reader.onload = (e) => {
if (previewEl) previewEl.classList.remove('placeholder');
           if (inner) { inner.innerHTML = window.renderProductImage(e.target.result, 'Preview', { style: 'max-height:100%;width:100%;object-fit:cover;', lazy: false }); }
           const card = heroCards.find(c => c.slot === slotIndex) || {};
           const deleteBtn = document.querySelector(`button[onclick="deleteHeroSlotImage(${slotIndex})"]`);
           if (deleteBtn && !card.imagen) deleteBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
      }

      function openHeroSlotModal(slotIndex) {
         state.currentHeroSlotIndex = slotIndex;
         document.getElementById('heroSlotModalTitle').textContent = `Editar Slot ${slotIndex + 1}`;
         clearSaveStatus('heroSlotSaveStatus');
         const card = heroCards.find(c => c.slot === slotIndex) || {};
         document.getElementById('heroSlotTitle').value = card.titulo || '';
         document.getElementById('heroSlotSubtitle').value = card.subtitulo || '';
         document.getElementById('heroSlotCtaText').value = card.cta_texto || '';
         document.getElementById('heroSlotCtaUrl').value = card.cta_url || '';
         document.getElementById('heroSlotImage').value = card.imagen || '';
         const modalFileInput = document.getElementById('heroSlotImageFile');
         if (modalFileInput) modalFileInput.value = '';
         const preview = document.getElementById('heroSlotImagePreview');
         const hasImage = card.imagen || heroPendingFiles[slotIndex];
         preview.style.display = hasImage ? 'block' : 'none';
         if (hasImage) {
            if (heroPendingFiles[slotIndex]) {
              const reader = new FileReader();
              reader.onload = (e) => {
                preview.innerHTML = window.renderProductImage(e.target.result, 'Slot ' + (slotIndex + 1), { style: 'max-height:200px;width:100%;object-fit:cover;', lazy: false });
              };
              reader.readAsDataURL(heroPendingFiles[slotIndex]);
            } else {
               preview.innerHTML = window.renderProductImage(card.imagen || '', 'Slot ' + (slotIndex + 1), { style: 'max-height:200px;width:100%;object-fit:cover;', lazy: false });
            }
         } else {
           preview.innerHTML = '';
         }
         const deleteBtn = document.getElementById('heroSlotDeleteBtn');
         if (deleteBtn) deleteBtn.style.display = hasImage ? 'inline-flex' : 'none';
         const overlay = document.getElementById('heroSlotModalOverlay');
         overlay.classList.add('active');
         openModalScrollLock(overlay, closeHeroSlotModal);
       }

      function closeHeroSlotModal() {
        document.getElementById('heroSlotModalOverlay').classList.remove('active');
        unlockModalScroll();
        state.currentHeroSlotIndex = null;
        clearSaveStatus('heroSlotSaveStatus');
      }

       async function saveHeroSlot(slotIndex) {
         const isModal = slotIndex === undefined;
         const idx = isModal ? state.currentHeroSlotIndex : slotIndex;

         if (idx === null || idx === undefined) return;

         let title, subtitle, ctaText, ctaUrl, image;

         if (isModal) {
           title = document.getElementById('heroSlotTitle').value.trim();
           subtitle = document.getElementById('heroSlotSubtitle').value.trim();
           ctaText = document.getElementById('heroSlotCtaText').value.trim();
           ctaUrl = document.getElementById('heroSlotCtaUrl').value.trim();
           image = document.getElementById('heroSlotImage').value;
         } else {
           title = document.getElementById(`heroSlotTitle_${idx}`).value.trim();
           subtitle = document.getElementById(`heroSlotSubtitle_${idx}`).value.trim();
           ctaText = document.getElementById(`heroSlotCtaText_${idx}`).value.trim();
           ctaUrl = document.getElementById(`heroSlotCtaUrl_${idx}`).value.trim();
           image = document.getElementById(`heroSlotImage_${idx}`).value;
         }

         if (!image && !heroPendingFiles[idx]) {
           const msg = '❌ La imagen es requerida';
           if (isModal) {
             showSaveStatus('heroSlotSaveStatus', 'error', msg);
           } else {
             showToast(msg, 'error');
           }
           return;
         }

         const file = heroPendingFiles[idx];

         try {
           if (isModal) {
             showSaveStatus('heroSlotSaveStatus', 'saving', 'Guardando...');
           } else {
             const btn = document.querySelector(`button[onclick="saveHeroSlot(${idx})"]`);
             if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }
           }

           if (file) {
             const formData = new FormData();
             formData.append('image', file);
             formData.append('titulo', title);
             formData.append('subtitulo', subtitle);
             formData.append('cta_texto', ctaText);
             formData.append('cta_url', ctaUrl);
             formData.append('slot', String(idx));
             formData.append('tipo', 'hero');
             formData.append('activo', 'true');

             await adminFetch(`/api/admin/hero-cards/hero/${idx}`, { method: 'PUT', body: formData });
             delete heroPendingFiles[idx];
           } else {
             const payload = { titulo: title, subtitulo: subtitle, cta_texto: ctaText, cta_url: ctaUrl, imagen: image, slot: idx, tipo: 'hero', activo: true };
             await adminFetch(`/api/admin/hero-cards/hero/${idx}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
           }

            if (isModal) {
              showSaveStatus('heroSlotSaveStatus', 'success', '✅ Guardado');
              await loadHeroCardsAdmin();
              emitSync('hero_updated');
              setTimeout(() => { hideSaveStatus('heroSlotSaveStatus'); closeHeroSlotModal(); }, 1500);
            } else {
              showToast('Slot guardado', 'success');
              await loadHeroCardsAdmin();
              emitSync('hero_updated');
            }
         } catch (err) {
           if (isModal) {
             showSaveStatus('heroSlotSaveStatus', 'error', '❌ ' + err.message);
             setTimeout(() => hideSaveStatus('heroSlotSaveStatus'), 3000);
           } else {
             showToast(err.message, 'error');
             const btn = document.querySelector(`button[onclick="saveHeroSlot(${idx})"]`);
             if (btn) { btn.disabled = false; btn.innerHTML = '💾 Guardar slot'; }
           }
         }
       }

       async function deleteHeroSlotImage(slotIndex) {
         if (!confirm('¿Eliminar la imagen de este slot?')) return;
         try {
           await adminFetch(`/api/admin/hero-cards/hero/${slotIndex}/imagen`, { method: 'DELETE' });
           delete heroPendingFiles[slotIndex];
           showToast('Imagen eliminada', 'success');
           await loadHeroCardsAdmin();
         } catch (err) {
           showToast(err.message, 'error');
         }
       }

       async function syncHeroCards() {
        try {
          const btn = document.getElementById('syncHeroBtn');
          if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }

          const cards = [];
          for (let i = 0; i < 2; i++) {
            const title = document.getElementById(`heroSlotTitle_${i}`).value.trim();
            const subtitle = document.getElementById(`heroSlotSubtitle_${i}`).value.trim();
            const ctaText = document.getElementById(`heroSlotCtaText_${i}`).value.trim();
            const ctaUrl = document.getElementById(`heroSlotCtaUrl_${i}`).value.trim();
            const image = document.getElementById(`heroSlotImage_${i}`).value;

            cards.push({
              slot: i,
              titulo: title,
              subtitulo: subtitle,
              cta_texto: ctaText,
              cta_url: ctaUrl,
              imagen: image,
              tipo: 'hero',
              activo: true
            });
          }

          const invalid = cards.filter(c => !c.imagen && !heroPendingFiles[c.slot]);
          if (invalid.length > 0) {
            showToast('Todos los slots deben tener imagen', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '💾 Guardar todo'; }
            return;
          }

          for (const card of cards) {
            if (heroPendingFiles[card.slot]) {
              const formData = new FormData();
              formData.append('image', heroPendingFiles[card.slot]);
              formData.append('titulo', card.titulo);
              formData.append('subtitulo', card.subtitulo);
              formData.append('cta_texto', card.cta_texto);
              formData.append('cta_url', card.cta_url);
              formData.append('slot', String(card.slot));
              formData.append('tipo', 'hero');
              formData.append('activo', 'true');

              await adminFetch(`/api/admin/hero-cards/hero/${card.slot}`, { method: 'PUT', body: formData });
              delete heroPendingFiles[card.slot];
            } else {
              await adminFetch(`/api/admin/hero-cards/hero/${card.slot}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(card)
              });
            }
          }

          showToast('Slots sincronizados', 'success');
           await loadHeroCardsAdmin();
           emitSync('hero_updated');
         } catch (err) {
          showToast(err.message, 'error');
        } finally {
          const btn = document.getElementById('syncHeroBtn');
          if (btn) { btn.disabled = false; btn.innerHTML = '💾 Guardar todo'; }
        }
      }

async function loadSettings() {
       try {
         const res = await adminFetch('/api/admin/settings');
         const data = await res.json();
         if (data.business_name) document.getElementById('settingBusinessName').value = data.business_name;
         if (data.logo) document.getElementById('settingLogo').value = data.logo;
         if (data.email) document.getElementById('settingEmail').value = data.email;
         if (data.whatsapp) document.getElementById('settingWhatsapp').value = data.whatsapp;
         if (data.address) document.getElementById('settingAddress').value = data.address;
          if (data.instagram) document.getElementById('settingInstagram').value = data.instagram;
          if (data.facebook) document.getElementById('settingFacebook').value = data.facebook;
          if (data.twitter) document.getElementById('settingTwitter').value = data.twitter;
          if (data.whatsapp_business) document.getElementById('settingWhatsappBusiness').value = data.whatsapp_business;
          const payment = data.payment || data || {};
          if (payment.mp_enabled !== undefined) document.getElementById('settingMpEnabled').checked = payment.mp_enabled === true || payment.mp_enabled === 'true';
          if (payment.cash_enabled !== undefined) document.getElementById('settingCashEnabled').checked = payment.cash_enabled === true || payment.cash_enabled === 'true';
          if (payment.mp_alias) document.getElementById('settingMpAlias').value = payment.mp_alias;
          if (payment.holder_name) document.getElementById('settingHolderName').value = payment.holder_name;
          if (payment.cbu_cvu) document.getElementById('settingCbuCvu').value = payment.cbu_cvu;
          if (payment.message) document.getElementById('settingPaymentMessage').value = payment.message;
          if (payment.shipping_cost !== undefined) document.getElementById('settingShippingCost').value = payment.shipping_cost;
          if (payment.free_shipping_from !== undefined) document.getElementById('settingFreeShippingFrom').value = payment.free_shipping_from;
          if (data.shipping_zones !== undefined) {
            window.shippingZones = data.shipping_zones;
            renderShippingZones();
          }
        } catch (err) {
         console.error('[loadSettings] Error:', err);
         showToast('Error al cargar la configuración', 'error');
       }
     }

async function saveSettings() {
       const payload = {
         business_name: document.getElementById('settingBusinessName').value.trim(),
         logo: document.getElementById('settingLogo').value.trim(),
         email: document.getElementById('settingEmail').value.trim(),
         whatsapp: document.getElementById('settingWhatsapp').value.trim(),
         address: document.getElementById('settingAddress').value.trim(),
          instagram: document.getElementById('settingInstagram').value.trim(),
          facebook: document.getElementById('settingFacebook').value.trim(),
          twitter: document.getElementById('settingTwitter').value.trim(),
          whatsapp_business: document.getElementById('settingWhatsappBusiness').value.trim(),
         mp_enabled: document.getElementById('settingMpEnabled').checked,
         cash_enabled: document.getElementById('settingCashEnabled').checked,
         mp_alias: document.getElementById('settingMpAlias').value.trim(),
         holder_name: document.getElementById('settingHolderName').value.trim(),
          cbu_cvu: document.getElementById('settingCbuCvu').value.trim(),
          payment_message: document.getElementById('settingPaymentMessage').value.trim(),
          shipping_zones: window.shippingZones || [],
          shipping_cost: Number(document.getElementById('settingShippingCost').value) || 0,
          free_shipping_from: Number(document.getElementById('settingFreeShippingFrom').value) || 0,
        };
        try {
          showSaveStatus('settingsSaveStatus', 'saving', 'Guardando...');
          await adminFetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          showSaveStatus('settingsSaveStatus', 'success', '✅ Configuración guardada');
          emitSync('settings_updated');
          setTimeout(() => hideSaveStatus('settingsSaveStatus'), 2000);
        } catch (err) {
         showSaveStatus('settingsSaveStatus', 'error', '❌ ' + err.message);
          setTimeout(() => hideSaveStatus('settingsSaveStatus'), 3000);
        }
      }

      window.shippingZones = [];

      function renderShippingZones() {
        const zones = window.shippingZones || [];
        const container = document.getElementById('shippingZonesList');
        if (!container) return;
        if (!zones.length) {
          container.innerHTML = '<p class=\'empty-state\'>No hay zonas configuradas. Agregá una zona para definir envíos a distintas localidades.</p>';
          return;
        }
        container.innerHTML = zones.map((z, i) => `<div class='shipping-zone-item' style='display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;padding:0.5rem;border:1.5px solid var(--border);border-radius:8px;'>
          <input type='text' placeholder='Localidad / CP' value='${escapeHtml(z.localidad || '')}' onchange='updateShippingZone(${i}, "localidad", this.value)' style='flex:1;' />
          <input type='number' placeholder='Costo' min='0' value='${z.costo || 0}' onchange='updateShippingZone(${i}, "costo", this.value)' style='width:80px;padding:4px 6px;font-size:0.85rem;' />
          <label style='display:flex;align-items:center;gap:4px;font-size:0.8rem;'><input type='checkbox' ${z.gratis ? 'checked' : ''} onchange='updateShippingZone(${i}, "gratis", this.checked)' /> Gratis</label>
          <button class='btn btn-danger btn-sm' onclick='removeShippingZone(${i})'>🗑</button>
        </div>`).join('');
      }

      function addShippingZone() {
        if (!window.shippingZones) window.shippingZones = [];
        window.shippingZones.push({ localidad: '', costo: 0, gratis: false });
        renderShippingZones();
      }

       /* eslint-disable-next-line no-unused-vars */
       function removeShippingZone(index) {
        window.shippingZones.splice(index, 1);
        renderShippingZones();
      }

       /* eslint-disable-next-line no-unused-vars */
       function updateShippingZone(index, field, value) {
        if (!window.shippingZones[index]) return;
        window.shippingZones[index][field] = field === 'gratis' ? value === true : (field === 'costo' ? Number(value) || 0 : value);
      }

       async function exportCSV(type) {
       let csv = '';
       let filename = '';
       if (type === 'products') {
         filename = 'productos.csv';
         csv = 'ID,Nombre,Categoría,Precio,Stock,Slug,Descripción\n';
         products.forEach(p => {
           csv += `${p.id},"${p.name}",${p.category},${p.price},${p.stock},"${p.slug || ''}","${(p.description || '').replace(/"/g, '""')}"\n`;
         });
       } else if (type === 'testimonials') {
         filename = 'testimonios.csv';
         csv = 'Nombre,Comentario,Valoración,Orden,Estado\n';
         testimonials.forEach(t => {
           csv += `"${t.name}","${(t.comment || '').replace(/"/g, '""')}",${t.rating},${t.orden || 0},${t.active}\n`;
         });
       }
      if (!csv) { showToast('Tipo de exportación no válido', 'error'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV exportado', 'success');
    }

     async function viewOrder(id) {
        state.currentOrderId = id;
        try {
          const res = await adminFetch(`/api/admin/orders/${id}`);
          const order = await res.json();
          const customer = order.customer || {};
           const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? safeJsonParse(order.items, []) : []);
           const itemsText = items.map((it, i) => `${i+1}. ${escapeHtml(it.name || 'Producto')} x${it.quantity || 1} — $${Number(it.price || 0).toLocaleString('es-AR')}`).join('<br/>');
           document.getElementById('orderDetailTitle').textContent = `Pedido #${order.id}`;
           document.getElementById('orderDetailContent').innerHTML = `<div class='order-detail-grid'>
             <div><strong>Cliente:</strong> ${escapeHtml(customer.name || '—')}</div>
             <div><strong>Email:</strong> ${escapeHtml(customer.email || '—')}</div>
             <div><strong>Teléfono:</strong> ${escapeHtml(customer.phone || '—')}</div>
             <div><strong>Dirección:</strong> ${escapeHtml(customer.address || '—')}</div>
            <div><strong>Total:</strong> $${Number(order.total).toLocaleString('es-AR')}</div>
            <div><strong>Estado:</strong> ${order.status || 'pending'}</div>
            <div><strong>Medio de pago:</strong> ${order.payment_method || '—'}</div>
            <div style='grid-column:1/-1'><strong>Items:</strong><br/>${itemsText || 'Sin items'}</div>
          </div>
          <div class='form-group' style='margin-top:1rem'>
            <label>Cambiar estado</label>
            <select id='orderStatusSelect' onchange='changeOrderStatus(${order.id})'>
              <option value='pending' ${order.status === 'pending' ? 'selected' : ''}>Pendiente</option>
              <option value='confirmed' ${order.status === 'confirmed' ? 'selected' : ''}>Confirmado</option>
              <option value='preparing' ${order.status === 'preparing' ? 'selected' : ''}>Preparando</option>
              <option value='shipped' ${order.status === 'shipped' ? 'selected' : ''}>Enviado</option>
              <option value='delivered' ${order.status === 'delivered' ? 'selected' : ''}>Entregado</option>
              <option value='cancelled' ${order.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>`;
          document.getElementById('orderNotes').value = order.notes || '';
          const overlay = document.getElementById('orderDetailModalOverlay');
          overlay.classList.add('active');
          openModalScrollLock(overlay, closeOrderDetailModal);
         } catch (err) {
           showToast(err.message, 'error');
         }
       }

     async function changeOrderStatus(id, newStatus) {
         const select = document.getElementById('orderStatusSelect');
         const status = select ? select.value : newStatus;
         if (!status) return;
         try {
           await adminFetch(`/api/admin/orders/${id}/status`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ status })
           });
          showToast('Estado actualizado', 'success');
          await loadOrders();
          emitSync('order_status_updated');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }

      function closeOrderDetailModal() {
        document.getElementById('orderDetailModalOverlay').classList.remove('active');
        unlockModalScroll();
        state.currentOrderId = null;
      }

     async function saveOrderNotes() {
      if (!state.currentOrderId) return;
      const notes = document.getElementById('orderNotes').value;
      try {
        await adminFetch(`/api/admin/orders/${state.currentOrderId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes })
        });
        showSaveStatus('orderDetailSaveStatus', 'success', '✅ Nota guardada');
        setTimeout(() => hideSaveStatus('orderDetailSaveStatus'), 2000);
      } catch (err) {
        showSaveStatus('orderDetailSaveStatus', 'error', '❌ ' + err.message);
        setTimeout(() => hideSaveStatus('orderDetailSaveStatus'), 3000);
      }
    }

    async function resetMetrics() {
      if (!confirm('¿Seguro que querés reiniciar todas las métricas? Esta acción no se puede deshacer')) return;
      try {
        const res = await adminFetch('/api/admin/reports/reset', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al reiniciar métricas');
        showToast(`Métricas reiniciadas correctamente. ${data.archived || 0} pedidos archivados.`, 'success');
        loadSalesReport();
        loadSalesTrend();
        loadWeeklySummary();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadWeeklySummary() {
      try {
        const res = await adminFetch('/api/admin/reports/weekly-summary');
        const data = await res.json();
        renderWeeklySummary(data);
      } catch (err) {
        console.error('[loadWeeklySummary] Error:', err);
        const container = document.getElementById('weeklySummary');
        if (container) container.innerHTML = '<div class=\'empty-state\'>Error al cargar el resumen semanal.</div>';
      }
    }

    function renderWeeklySummary(data) {
      const container = document.getElementById('weeklySummary');
      if (!container) return;
      const fmt = n => '$' + Number(n).toLocaleString('es-AR');
      const nivelColor = data.nivelVentas === 'Alta' ? '#16a34a' : (data.nivelVentas === 'Media' ? '#d97706' : '#dc2626');
      container.innerHTML = `<div class='weekly-summary'>
        <h4 style="font-family:'Playfair Display', serif; margin-bottom:1rem;">Resumen semanal</h4>
        <div class='weekly-grid'>
          <div class='weekly-card'><div class='weekly-value'>${data.pedidosSemana}</div><div class='weekly-label'>Pedidos de la semana</div></div>
          <div class='weekly-card'><div class='weekly-value'>${fmt(data.totalSemana)}</div><div class='weekly-label'>Total vendido en la semana</div></div>
          <div class='weekly-card'><div class='weekly-value' style='color:${nivelColor}'>${data.nivelVentas}</div><div class='weekly-label'>Nivel de ventas</div></div>
        </div>
      </div>`;
    }

    document.getElementById('modalOverlay').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'Tab') {
        const modal = document.getElementById('modalOverlay');
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

     document.addEventListener('DOMContentLoaded', () => {
        if (authToken) {
          document.getElementById('loginOverlay').classList.add('hidden');
          const hash = window.location.hash.slice(1);
          const validSections = ['products','categories','orders','reports','testimonials','texts','heroImages','settings'];
          navigateTo(validSections.includes(hash) ? hash : 'products');
        }
       clearSaveStatus('settingsSaveStatus');

       const modalFileInput = document.getElementById('heroSlotImageFile');
       if (modalFileInput) {
         modalFileInput.addEventListener('change', () => {
           const idx = state.currentHeroSlotIndex;
           if (idx === null || idx === undefined) return;
           const file = modalFileInput.files[0];
           if (!file) return;
           heroPendingFiles[idx] = file;
           const preview = document.getElementById('heroSlotImagePreview');
           const reader = new FileReader();
           reader.onload = (e) => {
           preview.style.display = 'block';
             preview.innerHTML = window.renderProductImage(e.target.result, 'Slot ' + (idx + 1), { style: 'max-height:200px;width:100%;object-fit:cover;', lazy: false });
           };
           reader.readAsDataURL(file);
           const deleteBtn = document.getElementById('heroSlotDeleteBtn');
           if (deleteBtn) deleteBtn.style.display = 'inline-flex';
         });
       }
     });

    window.doLogin = doLogin;
    window.doLogout = doLogout;
    window.checkServerHealth = checkServerHealth;
    window.openSectionModal = openSectionModal;
    window.openCategoryModal = openCategoryModal;
    window.closeCategoryModal = closeCategoryModal;
    window.saveCategory = saveCategory;
    window.editCategory = editCategory;
    window.deleteCategory = deleteCategory;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.saveProduct = saveProduct;
    window.saveTestimonial = saveTestimonial;
    window.closeTestimonialModal = closeTestimonialModal;
    window.saveText = saveText;
    window.closeTextModal = closeTextModal;
    window.saveHeroSlot = saveHeroSlot;
    window.closeHeroSlotModal = closeHeroSlotModal;
    window.openHeroSlotModal = openHeroSlotModal;
    window.togglePasswordSection = togglePasswordSection;
    window.changePassword = changePassword;
    window.addShippingZone = addShippingZone;
    window.saveSettings = saveSettings;
    window.setReportPreset = setReportPreset;
    window.loadSalesReport = loadSalesReport;
    window.resetMetrics = resetMetrics;
    window.loadWeeklySummary = loadWeeklySummary;
    window.exportCSV = exportCSV;
    window.exportOrdersCSV = exportOrdersCSV;
    window.exportOrdersPDF = exportOrdersPDF;
    window.generateReceipt = generateReceipt;
    window.sendReceiptWhatsApp = sendReceiptWhatsApp;
    window.viewOrder = viewOrder;
    window.quickUpdateOrderStatus = quickUpdateOrderStatus;
    window.openDeleteOrderModal = openDeleteOrderModal;
    window.closeDeleteOrderModal = closeDeleteOrderModal;
    window.confirmDeleteOrder = confirmDeleteOrder;
    window.editTestimonial = editTestimonial;
    window.deleteTestimonial = deleteTestimonial;
    window.toggleTestimonialActive = toggleTestimonialActive;
    window.editText = editText;
    window.syncHeroCards = syncHeroCards;
    window.deleteHeroSlotImage = deleteHeroSlotImage;
    window.previewHeroSlotImage = previewHeroSlotImage;
    window.deleteCurrentHeroSlotImage = function () {
      const idx = state.currentHeroSlotIndex;
      if (idx !== null && idx !== undefined) {
        delete heroPendingFiles[idx];
        deleteHeroSlotImage(idx);
      }
    };
    window.closeOrderDetailModal = closeOrderDetailModal;
    window.changeOrderStatus = changeOrderStatus;
    window.saveOrderNotes = saveOrderNotes;
    window.renderPagination = renderPagination;
