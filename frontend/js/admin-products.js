/* ==================== ADMIN PRODUCTS.JS ==================== */
/* CRUD completo de productos: crear, editar, eliminar (soft), filtrar, ordenar, imágenes */

(function () {
  'use strict';

  var productsCache = [];
  var categoriesCache = [];
  var currentSort = { field: 'id', dir: 'ASC' };
  var filters = { q: '', category: '', active: '', showInactive: false };
  var saving = false;
  var deleting = {};

  function showToast(icon, message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.innerHTML = '<span style="margin-right:0.5rem;">' + (icon || '') + '</span><span>' + message + '</span>';
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 3500);
  }

  function setButtonLoading(btnId, loadingId, loading, defaultText, loadingText) {
    var btn = document.getElementById(btnId);
    var load = document.getElementById(loadingId);
    if (btn) btn.disabled = loading;
    if (load) load.classList.toggle('hidden', !loading);
    var textSpan = load ? load.previousElementSibling : null;
    if (textSpan && textSpan.id === btnId + 'Text') {
      textSpan.textContent = loading ? (loadingText || 'Procesando...') : (defaultText || 'Guardar');
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatCurrency(value) {
    return '$' + Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function loadCategories() {
    try {
      var res = await window.adminFetch('/api/admin/categories', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando categorías');
      categoriesCache = await res.json();
      populateCategorySelect();
    } catch (err) {
      console.error('[Products] Error cargando categorías:', err);
    }
  }

  function populateCategorySelect() {
    var selects = [document.getElementById('product_category'), document.getElementById('filter_category'), document.getElementById('prod_category')];
    selects.forEach(function (select) {
      if (!select) return;
      var currentVal = select.value;
      var opts = '<option value="">Todas</option>';
      categoriesCache.filter(function (c) { return c.active; }).forEach(function (c) {
        opts += '<option value="' + escapeHtml(c.slug) + '">' + escapeHtml(c.name) + '</option>';
      });
      select.innerHTML = opts;
      if (currentVal) select.value = currentVal;
    });
  }

  async function loadProducts() {
    var tbody = document.getElementById('productsTableBody');
    var empty = document.getElementById('productsEmptyState');
    var container = document.getElementById('productsTableContainer');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">Cargando...</td></tr>';

    var params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    if (filters.active !== '') params.set('active', filters.active);
    if (currentSort.field) params.set('sort_by', currentSort.field);
    if (currentSort.dir) params.set('sort_order', currentSort.dir);

    try {
      var res = await window.adminFetch('/api/admin/products?' + params.toString(), { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando productos');
      var data = await res.json();
      productsCache = data.products || [];
      renderProducts();
    } catch (err) {
      console.error('[Products] Error:', err);
      showToast('❌', err.message || 'Error al cargar productos', 'error');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#dc2626;">Error al cargar</td></tr>';
    }
  }

  function renderProducts() {
    var tbody = document.getElementById('productsTableBody');
    var empty = document.getElementById('productsEmptyState');
    var container = document.getElementById('productsTableContainer');
    if (!tbody) return;

    if (!productsCache.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      renderMobileProducts();
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    productsCache.forEach(function (p) {
      var img = (p.images && p.images.length > 0) ? p.images[0].url : '';
      var catName = 'Sin categoría';
      var catSlug = p.category || '';
      var catObj = categoriesCache.find(function (c) { return c.slug === catSlug; });
      if (catObj) catName = catObj.name;

      var stockClass = p.stock > 0 ? 'badge-stock--ok' : 'badge-stock--out';
      var stockText = p.stock > 0 ? 'En stock (' + p.stock + ')' : 'Sin stock';

      html += '<tr data-id="' + p.id + '">' +
        '<td>' +
          '<div class="product-cell">' +
            '<div class="thumb">' + (img ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy" />' : (p.emoji || '📦')) + '</div>' +
            '<div>' +
              '<div class="product-name">' + escapeHtml(p.name) + '</div>' +
              '<div class="product-desc">' + escapeHtml((p.description || '').substring(0, 60)) + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="badge">' + escapeHtml(catName) + '</span></td>' +
        '<td class="price-cell">' + formatCurrency(p.price) + '</td>' +
        '<td style="text-align:center;"><span class="badge badge-stock ' + stockClass + '">' + stockText + '</span></td>' +
        '<td style="text-align:center;">' +
          '<label class="testimonial-active-toggle">' +
            '<input type="checkbox" ' + (p.active ? 'checked' : '') + ' onchange="window.toggleProductStatus(' + p.id + ')" ' + (deleting[p.id] ? 'disabled' : '') + ' />' +
            '<span class="slider"></span>' +
          '</label>' +
        '</td>' +
        '<td style="text-align:center;">' +
          '<div class="actions">' +
            '<button class="btn btn-secondary btn-sm" onclick="window.editProduct(' + p.id + ')" ' + (deleting[p.id] ? 'disabled' : '') + '>✏️</button>' +
            '<button class="btn btn-danger btn-sm" onclick="window.confirmDeleteProduct(' + p.id + ')" ' + (deleting[p.id] ? 'disabled' : '') + '>🗑️</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
    renderMobileProducts();
  }

  function renderMobileProducts() {
    var existing = document.getElementById('productsMobileCards');
    if (existing) existing.remove();

    var container = document.getElementById('productsTableContainer');
    if (!container) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'productsMobileCards';
    wrapper.className = 'products-mobile-cards';

    if (!productsCache.length) {
      wrapper.innerHTML = '<div class="empty-state"><h3>No se encontraron productos</h3><p>Creá tu primer producto con el botón de arriba.</p></div>';
      container.appendChild(wrapper);
      return;
    }

    var html = '';
    productsCache.forEach(function (p) {
      var img = (p.images && p.images.length > 0) ? p.images[0].url : '';
      var catName = 'Sin categoría';
      var catSlug = p.category || '';
      var catObj = categoriesCache.find(function (c) { return c.slug === catSlug; });
      if (catObj) catName = catObj.name;
      var stockClass = p.stock > 0 ? 'badge-stock--ok' : 'badge-stock--out';
      var stockText = p.stock > 0 ? 'En stock (' + p.stock + ')' : 'Sin stock';

      html += '<div class="product-mobile-card" data-id="' + p.id + '">' +
        '<div class="product-mobile-card-header">' +
          '<div class="thumb">' + (img ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy" />' : (p.emoji || '📦')) + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div class="product-name" style="font-size:0.95rem;">' + escapeHtml(p.name) + '</div>' +
            '<div class="product-desc" style="font-size:0.8rem;">' + escapeHtml(catName) + ' · ' + formatCurrency(p.price) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="product-mobile-card-body">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;">' +
            '<span>Stock:</span>' +
            '<span class="badge badge-stock ' + stockClass + '">' + stockText + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;">' +
            '<span>Estado:</span>' +
            '<label class="testimonial-active-toggle">' +
              '<input type="checkbox" ' + (p.active ? 'checked' : '') + ' onchange="window.toggleProductStatus(' + p.id + ')" ' + (deleting[p.id] ? 'disabled' : '') + ' />' +
              '<span class="slider"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="product-mobile-card-actions">' +
          '<button class="btn btn-secondary btn-sm" onclick="window.editProduct(' + p.id + ')" style="flex:1;">✏️ Editar</button>' +
          '<button class="btn btn-danger btn-sm" onclick="window.confirmDeleteProduct(' + p.id + ')" style="flex:1;" ' + (deleting[p.id] ? 'disabled' : '') + '>🗑️ Borrar</button>' +
        '</div>' +
      '</div>';
    });
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  }
  }

  window.toggleProductStatus = async function (id) {
    try {
      var res = await window.adminFetch('/api/admin/products/' + id + '/estado', { method: 'PATCH' });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error cambiando estado');
      }
      await loadProducts();
      showToast('✅', 'Estado actualizado', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al cambiar estado', 'error');
      await loadProducts();
    }
  };

  window.editProduct = function (id) {
    var p = productsCache.find(function (x) { return x.id === id; });
    if (!p) return;
    openProductModal(p);
  };

  window.confirmDeleteProduct = function (id) {
    var p = productsCache.find(function (x) { return x.id === id; });
    if (!p) return;
    var overlay = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var confirmBtn = document.getElementById('confirmModalAction');
    if (!overlay || !msg || !confirmBtn) return;

    msg.textContent = '¿Seguro que querés eliminar "' + p.name + '"? Esta acción no se puede deshacer.';
    confirmBtn.textContent = 'Eliminar';
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.onclick = function () {
      deleteProduct(id);
      closeConfirmModal();
    };
    openConfirmModal();
  };

  async function deleteProduct(id) {
    if (deleting[id]) return;
    deleting[id] = true;
    var btn = document.querySelector('button[onclick="window.confirmDeleteProduct(' + id + ')"]');
    if (btn) btn.disabled = true;

    try {
      var res = await window.adminFetch('/api/admin/products/' + id, { method: 'DELETE' });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error eliminando producto');
      }
      await loadProducts();
      showToast('✅', 'Producto eliminado correctamente', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al eliminar', 'error');
    } finally {
      deleting[id] = false;
    }
  }

  function openProductModal(product) {
    var modal = document.getElementById('productModalOverlay');
    var form = document.getElementById('productEditForm');
    var title = document.getElementById('productModalTitle');
    if (!modal || !form) return;

    if (title) title.textContent = product ? 'Editar producto' : 'Nuevo producto';
    form.dataset.editId = product ? product.id : '';
    form.dataset.existingImages = product && product.images ? JSON.stringify(product.images) : '[]';

    document.getElementById('prod_name').value = product ? product.name : '';
    document.getElementById('prod_price').value = product ? product.price : '';
    document.getElementById('prod_category').value = product ? (product.category || '') : '';
    document.getElementById('prod_stock').value = product ? product.stock : '';
    document.getElementById('prod_description').value = product ? (product.description || '') : '';
    document.getElementById('prod_emoji').value = product ? (product.emoji || '') : '';
    document.getElementById('prod_badge').value = product ? (product.badge || '') : '';
    document.getElementById('prod_sku').value = product ? (product.sku || '') : '';
    document.getElementById('prod_active').checked = product ? !!product.active : true;
    document.getElementById('prod_featured').checked = product ? !!product.featured : false;

    renderModalImageGallery(product ? product.images : []);
    modal.classList.add('active');
  }

  function closeProductModal() {
    var modal = document.getElementById('productModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  function renderModalImageGallery(images) {
    var container = document.getElementById('modalImageGallery');
    if (!container) return;
    if (!images || !images.length) {
      container.innerHTML = '<p style="color:#64748b;font-size:0.85rem;">Sin imágenes</p>';
      return;
    }
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:0.75rem;">';
    images.forEach(function (img, idx) {
      html += '<div class="product-image-item" data-idx="' + idx + '">' +
        '<div class="product-image-item-preview" style="height:100px;position:relative;">' +
          '<img src="' + escapeHtml(img.url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />' +
          '<div style="position:absolute;top:4px;right:4px;display:flex;gap:2px;">' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="window.moveModalImage(' + idx + ',-1)" style="padding:0.2rem 0.4rem;font-size:0.7rem;" ' + (idx === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="window.moveModalImage(' + idx + ',1)" style="padding:0.2rem 0.4rem;font-size:0.7rem;" ' + (idx === images.length - 1 ? 'disabled' : '') + '>↓</button>' +
            '<button type="button" class="btn btn-danger btn-sm" onclick="window.removeModalImage(' + idx + ')" style="padding:0.2rem 0.4rem;font-size:0.7rem;">×</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  window.moveModalImage = function (idx, direction) {
    var form = document.getElementById('productEditForm');
    var images = JSON.parse(form.dataset.existingImages || '[]');
    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= images.length) return;
    var temp = images[idx];
    images[idx] = images[newIdx];
    images[newIdx] = temp;
    form.dataset.existingImages = JSON.stringify(images);
    renderModalImageGallery(images);
  };

  window.removeModalImage = function (idx) {
    var form = document.getElementById('productEditForm');
    var images = JSON.parse(form.dataset.existingImages || '[]');
    images.splice(idx, 1);
    form.dataset.existingImages = JSON.stringify(images);
    renderModalImageGallery(images);
  };

  async function saveProduct() {
    if (saving) return;
    saving = true;
    var form = document.getElementById('productEditForm');
    var editId = form.dataset.editId;
    var btnId = editId ? 'updateProductBtn' : 'createProductBtn';
    var loadId = btnId + 'Loading';
    setButtonLoading(btnId, loadId, true, editId ? 'Guardar cambios' : 'Crear producto', 'Guardando...');

    var payload = {
      name: document.getElementById('prod_name').value.trim(),
      price: Number(document.getElementById('prod_price').value),
      category: document.getElementById('prod_category').value,
      stock: Number(document.getElementById('prod_stock').value) || 0,
      description: document.getElementById('prod_description').value.trim(),
      emoji: document.getElementById('prod_emoji').value.trim() || '📦',
      badge: document.getElementById('prod_badge').value.trim(),
      sku: document.getElementById('prod_sku').value.trim(),
      active: document.getElementById('prod_active').checked,
      featured: document.getElementById('prod_featured').checked
    };

    if (!payload.name || isNaN(payload.price) || payload.price <= 0) {
      showToast('❌', 'Nombre y precio son requeridos', 'error');
      setButtonLoading(btnId, loadId, false, editId ? 'Guardar cambios' : 'Crear producto', 'Guardando...');
      saving = false;
      return;
    }

    var newImages = [];
    var fileInput = document.getElementById('prod_images');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      var files = Array.from(fileInput.files).slice(0, 5);
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var singleForm = new FormData();
        singleForm.append('image', f);
        try {
          var uploadRes = await window.adminFetch('/api/admin/upload', {
            method: 'POST',
            body: singleForm
          });
          if (!uploadRes || !uploadRes.ok) {
            var errData = await uploadRes.json().catch(function () { return {}; });
            throw new Error(errData.error || 'Error subiendo imagen ' + (i + 1));
          }
          var uploadData = await uploadRes.json();
          newImages.push({ url: uploadData.url, filename: uploadData.filename, orden: i, es_principal: i === 0 });
        } catch (err) {
          showToast('❌', 'Error subiendo imágenes: ' + err.message, 'error');
          setButtonLoading(btnId, loadId, false, editId ? 'Guardar cambios' : 'Crear producto', 'Guardando...');
          saving = false;
          return;
        }
      }
    }

    var existingImages = JSON.parse(form.dataset.existingImages || '[]');
    var allImages = existingImages.concat(newImages);

    try {
      var url = editId ? '/api/admin/products/' + editId : '/api/admin/products';
      var method = editId ? 'PUT' : 'POST';
      var res = await window.adminFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error guardando producto');
      }
      var product = await res.json();
      var productId = product.id;

      if (allImages.length > 0) {
        var imgUrls = allImages.map(function (img) { return img.url; });
        var imgFormData = new FormData();
        imgFormData.append('imageUrls', JSON.stringify(imgUrls));
        var imgRes = await window.adminFetch('/api/admin/products/' + productId + '/images', {
          method: 'POST',
          body: imgFormData
        });
        if (!imgRes || !imgRes.ok) {
          var imgErr = await imgRes.json().catch(function () { return {}; });
          console.warn('Error guardando imágenes:', imgErr);
        }
        var ordenPayload = allImages.map(function (img, idx) { return { id: img.id, orden: idx }; }).filter(function (x) { return x.id; });
        if (ordenPayload.length > 0) {
          var syncForm = new FormData();
          syncForm.append('orden', JSON.stringify(ordenPayload));
          await window.adminFetch('/api/admin/products/' + productId + '/images/sync-order', {
            method: 'POST',
            body: syncForm
          }).catch(function (e) { console.warn('Error sincronizando orden:', e); });
        }
      }

      closeProductModal();
      await loadProducts();
      showToast('✅', editId ? 'Producto actualizado' : 'Producto creado', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al guardar', 'error');
    } finally {
      setButtonLoading(btnId, loadId, false, editId ? 'Guardar cambios' : 'Crear producto', 'Guardando...');
      saving = false;
    }
  }

  function handleImageSelect(files) {
    var preview = document.getElementById('imagePreviewContainer');
    if (!preview) return;
    preview.innerHTML = '';
    var allowed = ['image/jpeg', 'image/png', 'image/webp'];
    var maxSize = 5 * 1024 * 1024;
    var validFiles = Array.from(files).filter(function (f) {
      if (!allowed.includes(f.type)) {
        showToast('❌', 'Formato no permitido: ' + f.name + '. Usá JPG, PNG o WEBP.', 'error');
        return false;
      }
      if (f.size > maxSize) {
        showToast('❌', 'Imagen muy grande: ' + f.name + '. Máx 5MB.', 'error');
        return false;
      }
      return true;
    });
    if (validFiles.length > 5) {
      showToast('❌', 'Máximo 5 imágenes por producto.', 'error');
      validFiles = validFiles.slice(0, 5);
    }
    validFiles.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var wrapper = document.createElement('div');
        wrapper.className = 'image-preview-wrapper';
        wrapper.innerHTML = '<img src="' + e.target.result + '" class="image-preview-mini" /><button type="button" class="image-remove-btn" onclick="this.parentElement.remove()">×</button>';
        preview.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });
  }

  function initProductManager() {
    loadCategories();
    loadProducts();

    var filterInput = document.getElementById('productFilter');
    if (filterInput) {
      filterInput.addEventListener('input', function () {
        filters.q = this.value.trim();
        loadProducts();
      });
    }

    var filterCat = document.getElementById('filter_category');
    if (filterCat) {
      filterCat.addEventListener('change', function () {
        filters.category = this.value;
        loadProducts();
      });
    }

    var filterActive = document.getElementById('filter_active');
    if (filterActive) {
      filterActive.addEventListener('change', function () {
        filters.active = this.value;
        loadProducts();
      });
    }

    var showInactive = document.getElementById('showInactiveCheck');
    if (showInactive) {
      showInactive.addEventListener('change', function () {
        filters.showInactive = this.checked;
        filters.active = this.checked ? '' : 'true';
        if (filterActive) filterActive.value = filters.active;
        loadProducts();
      });
    }

    var headers = document.querySelectorAll('#productsTable th[data-sort]');
    headers.forEach(function (th) {
      th.style.cursor = 'pointer';
      th.addEventListener('click', function () {
        var field = this.getAttribute('data-sort');
        if (currentSort.field === field) {
          currentSort.dir = currentSort.dir === 'ASC' ? 'DESC' : 'ASC';
        } else {
          currentSort.field = field;
          currentSort.dir = 'ASC';
        }
        loadProducts();
      });
    });

    var createBtn = document.getElementById('createProductBtn');
    if (createBtn) createBtn.addEventListener('click', function () { openProductModal(null); });

    var updateBtn = document.getElementById('updateProductBtn');
    if (updateBtn) updateBtn.addEventListener('click', saveProduct);

    var closeBtn = document.getElementById('closeProductModal');
    if (closeBtn) closeBtn.addEventListener('click', closeProductModal);

    var imageInput = document.getElementById('prod_images');
    if (imageInput) {
      imageInput.addEventListener('change', function () {
        handleImageSelect(this.files);
      });
    }

    var modalOverlay = document.getElementById('productModalOverlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeProductModal();
      });
    }

    var confirmOverlay = document.getElementById('confirmModalOverlay');
    if (confirmOverlay) {
      confirmOverlay.addEventListener('click', function (e) {
        if (e.target === confirmOverlay) closeConfirmModal();
      });
    }
  }

  function closeConfirmModal() {
    var overlay = document.getElementById('confirmModalOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  window.initProductManager = initProductManager;
  window.editProduct = window.editProduct;
  window.confirmDeleteProduct = window.confirmDeleteProduct;
  window.toggleProductStatus = window.toggleProductStatus;
  window.moveModalImage = window.moveModalImage;
  window.removeModalImage = window.removeModalImage;
})();
