/* ==================== ADMIN PRODUCTS.JS ==================== */
/* Modal CRUD, soft-delete, preview de imÃ¡genes */

(function () {
  'use strict';

  var editingProductId = null;
  var selectedFiles = [];
  var productList = [];

  /* ===== CARGA DE DATOS ===== */

  async function loadProducts() {
    var tbody = document.getElementById('productsTableBody');
    var empty = document.getElementById('productsEmptyState');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Cargando productos...</td></tr>';

    try {
      var res = await window.adminFetch('/api/admin/products?limit=100', { method: 'GET' });
      if (!res || !res.ok) {
        throw new Error('No se pudieron cargar los productos');
      }
      var data = await res.json();
      productList = (data.products || []).filter(function (p) { return !p.deleted; });
      renderProducts(productList);
    } catch (err) {
      console.error('[Products] Error:', err);
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="error-row">Error: ' + escapeHtml(err.message || 'desconocido') + '</td></tr>';
      window.showToast('âŒ', 'No se pudieron cargar los productos.', 'error');
    } finally {
      if (empty) empty.style.display = productList.length ? 'none' : 'block';
    }
  }

  async function loadCategories() {
    var select = document.getElementById('prod_category');
    var featuredSelect = document.getElementById('featured_categories');
    var filterCategory = document.getElementById('filter_category');

    try {
      var res = await window.adminFetch('/api/categories', { method: 'GET' });
      if (res && res.ok) {
        var data = await res.json();
        var items = Array.isArray(data) ? data : (data.categories || []);
        var catOptions = items.map(function (c) {
          var name = c.name || c.slug;
          return '<option value="' + escapeAttr(c.slug) + '">' + escapeAttr(name) + '</option>';
        });
        var featuredOpts = items.map(function (c) {
          var name = c.name || c.slug;
          return '<option value="' + escapeAttr(c.slug) + '">' + escapeAttr(name) + '</option>';
        });

        if (select) select.innerHTML = '<option value="">Sin categorÃ­a</option>' + catOptions.join('');
        if (featuredSelect) featuredSelect.innerHTML = featuredOpts.join('');

        var filterOpts = '<option value="">Todas las categorÃ­as</option>' + catOptions.join('');
        if (filterCategory) filterCategory.innerHTML = filterOpts;
      } else {
        throw new Error('fallback');
      }
    } catch (err) {
      if (select) select.innerHTML =
        '<option value="">Sin categorÃ­a</option>' +
        '<option value="pulseras">Pulseras</option>' +
        '<option value="accesorios">Accesorios</option>' +
        '<option value="souvenirs">Souvenirs</option>' +
        '<option value="collares">Collares</option>';
      if (featuredSelect) featuredSelect.innerHTML =
        '<option value="pulseras">Pulseras</option>' +
        '<option value="accesorios">Accesorios</option>' +
        '<option value="souvenirs">Souvenirs</option>' +
        '<option value="collares">Collares</option>';
      if (filterCategory) {
        filterCategory.innerHTML =
          '<option value="">Todas las categorÃ­as</option>' +
          '<option value="pulseras">Pulseras</option>' +
          '<option value="accesorios">Accesorios</option>' +
          '<option value="souvenirs">Souvenirs</option>' +
          '<option value="collares">Collares</option>';
      }
    }
  }

  function applyProductFilters() {
    var searchVal = (document.getElementById('productFilter')?.value || '').toLowerCase();
    var categoryVal = (document.getElementById('filter_category')?.value || '').toLowerCase();
    var activeVal = (document.getElementById('filter_active')?.value || '');
    var showInactive = document.getElementById('showInactiveCheck')?.checked || false;
    var showFeaturedOnly = document.getElementById('showFeaturedCheck')?.checked || false;

    var filtered = productList.filter(function (p) {
      var matchesSearch = (p.name || '').toLowerCase().indexOf(searchVal) !== -1 ||
                         (p.category || '').toLowerCase().indexOf(searchVal) !== -1 ||
                         (p.sku || '').toLowerCase().indexOf(searchVal) !== -1;

      var matchesCategory = !categoryVal || (p.category || '').toLowerCase() === categoryVal;

      var matchesActive = !activeVal || (activeVal === 'true' && p.active) || (activeVal === 'false' && !p.active);

      var matchesInactive = showInactive || p.active;

      var matchesFeatured = !showFeaturedOnly || p.featured;

      return matchesSearch && matchesCategory && matchesActive && matchesInactive && matchesFeatured;
    });

    renderProducts(filtered);
  }

  /* ===== RENDER ===== */

  function renderProducts(products) {
    var tbody = document.getElementById('productsTableBody');
    var mobileContainer = document.getElementById('productsMobileCards');
    var empty = document.getElementById('productsEmptyState');

    if (!products.length) {
      if (tbody) tbody.innerHTML = '';
      if (mobileContainer) mobileContainer.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    var rowsHtml = products.map(function (p) {
      var imgUrl = window.getProductImageUrl(p) || '';
      var thumbnail = imgUrl
        ? '<img src="' + escapeAttr(imgUrl) + '" alt="' + escapeAttr(p.name) + '" class="thumb" onerror="window.imgError(this)" />'
        : '<div class="thumb">' + (p.emoji || 'ðŸ“¿') + '</div>';

      var stock = Number(p.stock || 0);

      return '<tr data-product-id="' + p.id + '">' +
        '<td>' + thumbnail + '</td>' +
        '<td><div class="product-name">' + escapeHtml(p.name || '') + '</div>' +
          '<div class="product-desc" title="' + escapeHtml(p.description || '') + '">' + escapeHtml((p.description || '').substring(0, 60)) + '</div></td>' +
        '<td>' + escapeHtml(p.category || 'Sin categorÃ­a') + '</td>' +
        '<td class="price-cell">$' + Number(p.price || 0).toLocaleString('es-AR') + '</td>' +
        '<td class="stock-cell">' + renderStockCell(stock) + '</td>' +
        '<td class="status-cell">' + renderStatusCell(p.active) + '</td>' +
        '<td class="actions-cell">' +
          '<button class="btn btn-sm btn-secondary" onclick="window.editProduct(' + p.id + ')" title="Editar">âœï¸</button>' +
          '<button class="btn btn-sm btn-danger" onclick="window.deleteProductConfirm(' + p.id + ')" title="Eliminar">ðŸ—‘</button>' +
        '</td></tr>';
    }).join('');

    if (tbody) tbody.innerHTML = rowsHtml;

    if (mobileContainer) {
      mobileContainer.innerHTML = products.map(function (p) {
        var imgUrl = window.getProductImageUrl(p) || '';
        var thumbnail = imgUrl
          ? '<img src="' + escapeAttr(imgUrl) + '" alt="' + escapeAttr(p.name) + '" class="product-mobile-thumb" onerror="window.imgError(this)" />'
          : '<div class="product-mobile-thumb">' + (p.emoji || 'ðŸ“¿') + '</div>';
        var stock = Number(p.stock || 0);

        return '<div class="product-mobile-card" data-product-id="' + p.id + '">' +
          '<div class="product-mobile-card-header">' +
            thumbnail +
            '<div class="product-mobile-card-body">' +
              '<div class="product-name">' + escapeHtml(p.name || '') + '</div>' +
              '<div class="product-desc">' + escapeHtml((p.description || '').substring(0, 80)) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="product-mobile-card-meta">' +
            '<span class="product-category">' + escapeHtml(p.category || 'Sin categorÃ­a') + '</span>' +
            '<span class="product-price">$' + Number(p.price || 0).toLocaleString('es-AR') + '</span>' +
            renderStockBadge(stock) +
            renderStatusCell(p.active) +
          '</div>' +
          '<div class="product-mobile-card-actions">' +
            '<button class="btn btn-sm btn-secondary" onclick="window.editProduct(' + p.id + ')" title="Editar">âœï¸ Editar</button>' +
            '<button class="btn btn-sm btn-danger" onclick="window.deleteProductConfirm(' + p.id + ')" title="Eliminar">ðŸ—‘ Eliminar</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  function renderStockCell(stock) {
    if (stock <= 5) {
      return '<span class="badge badge-stock--low" title="Stock bajo">' + stock + ' âš ï¸</span>';
    }
    return '<span class="text-stock">' + stock + '</span>';
  }

  function renderStockBadge(stock) {
    if (stock <= 5) {
      return '<span class="badge badge-stock--low" title="Stock bajo">' + stock + ' âš ï¸</span>';
    }
    return '<span class="text-stock">' + stock + '</span>';
  }

  function renderStatusCell(active) {
    return '<span class="badge ' + (active ? 'badge-stock--ok' : 'badge-stock--out') + '">' +
      (active ? 'Activo' : 'Inactivo') + '</span>';
  }

  function renderImagePreviews() {
    var container = document.getElementById('modalImageGallery');
    if (!container) return;

    container.innerHTML = '';

    selectedFiles.forEach(function (file, index) {
      var url = URL.createObjectURL(file);
      var div = document.createElement('div');
      div.className = 'modal-image-item';
      div.innerHTML = '<img src="' + url + '" alt="Preview" />' +
        '<button type="button" class="modal-image-remove" onclick="window.removeImagePreview(' + index + ')" title="Quitar">âœ•</button>';
      container.appendChild(div);
    });
  }

  function validateFormInline() {
    var name = (document.getElementById('prod_name')?.value || '').trim();
    var price = parseFloat(document.getElementById('prod_price')?.value || '');
    var nameGroup = document.getElementById('prod_name_group');
    var priceGroup = document.getElementById('prod_price_group');
    var nameError = document.getElementById('prod_name_error');
    var priceError = document.getElementById('prod_price_error');

    var valid = true;

    if (!name) {
      nameGroup?.classList.add('is-invalid');
      if (nameError) nameError.textContent = 'El nombre es obligatorio';
      valid = false;
    } else {
      nameGroup?.classList.remove('is-invalid');
      if (nameError) nameError.textContent = '';
    }

    if (isNaN(price) || price <= 0) {
      priceGroup?.classList.add('is-invalid');
      if (priceError) priceError.textContent = 'IngresÃ¡ un precio mayor a 0';
      valid = false;
    } else {
      priceGroup?.classList.remove('is-invalid');
      if (priceError) priceError.textContent = '';
    }

    return valid;
  }

  function clearFormValidation() {
    document.getElementById('prod_name_group')?.classList.remove('is-invalid');
    document.getElementById('prod_price_group')?.classList.remove('is-invalid');
    document.getElementById('prod_name_error').textContent = '';
    document.getElementById('prod_price_error').textContent = '';
  }

  /* ===== GUARDAR (FORMULARIO DEL MODAL) ===== */

  async function saveProductToApi() {
    var formData = new FormData();
    formData.append('name', (document.getElementById('prod_name')?.value || '').trim());
    formData.append('category', document.getElementById('prod_category')?.value || '');
    formData.append('price', document.getElementById('prod_price')?.value || '0');
    formData.append('description', document.getElementById('prod_description')?.value.trim() || '');
    formData.append('emoji', document.getElementById('prod_emoji')?.value || 'ðŸ“¿');
    formData.append('stock', document.getElementById('prod_stock')?.value || '0');
    formData.append('featured', document.getElementById('prod_featured')?.checked ? 'true' : 'false');
    formData.append('active', document.getElementById('prod_active')?.checked ? 'true' : 'false');
    formData.append('sku', document.getElementById('prod_sku')?.value || '');
    formData.append('badge', document.getElementById('prod_badge')?.value || '');

    var res;
    if (editingProductId) {
      res = await window.adminFetch('/api/admin/products/' + editingProductId, {
        method: 'PUT',
        body: formData
      });
    } else {
      res = await window.adminFetch('/api/admin/products', {
        method: 'POST',
        body: formData
      });
    }

    if (!res || !res.ok) {
      var errMsg = editingProductId ? 'Error al actualizar el producto.' : 'Error al crear el producto.';
      if (res) {
        var errData = await res.json().catch(function () { return {}; });
        errMsg = errData.error || errMsg;
      }
      throw new Error(errMsg);
    }

    var product = await res.json();
    return product.id || editingProductId;
  }

  async function handleProductSubmit(e) {
    e.preventDefault();
    if (!validateFormInline()) return;

    await window.saveToCloud('products', {
      btnId: 'saveProductBtn',
      loadingId: 'saveProductBtnLoading',
      defaultText: 'Guardar en Nube',
      loadingText: 'Guardando...',
      successMessage: 'Producto guardado âœ…',
      action: async function () {
        var productId = await saveProductToApi();
        if (selectedFiles.length > 0) {
          await uploadProductImages(productId);
        }
        await loadProducts();
        closeProductModal();
      }
    });
  }

  async function uploadProductImages(productId) {
    if (!selectedFiles.length) return;
    
    var imageFormData = new FormData();
    selectedFiles.forEach(function (file) {
      imageFormData.append('images', file);
    });

    var res = await window.adminFetch('/api/products/' + productId + '/images', {
      method: 'POST',
      body: imageFormData
    });

    if (!res || !res.ok) {
      var errMsg = 'No se pudieron subir las imÃ¡genes.';
      if (res) {
        var errData = await res.json().catch(function () { return {}; });
        errMsg = errData.error || errMsg;
      }
      console.error('[Products] Error subiendo imÃ¡genes:', errMsg);
      throw new Error(errMsg);
    }
    
    var data = await res.json();

    if (data.images && data.images.length) {
      var emptyUrls = data.images.filter(function (img) { return !img.url; });
      if (emptyUrls.length > 0) {
        throw new Error('No se pudo obtener la URL de ' + emptyUrls.length + ' imagen(es). VerificÃ¡ la conexiÃ³n e intentÃ¡ nuevamente.');
      }
    }
    return data;
  }

  /* ===== GESTIÃ“N DE IMÃGENES EXISTENTES ===== */
  var productExistingImages = [];
  var draggedImageId = null;

  async function loadProductImages(productId) {
    var gallery = document.getElementById('productImageGallery');
    var section = document.getElementById('productExistingImagesSection');
    if (!gallery || !section) return;

    try {
      var res = await window.adminFetch('/api/products/' + productId + '/images', { method: 'GET' });
      if (!res || !res.ok) throw new Error('No se pudieron cargar las imÃ¡genes');
      var data = await res.json();
      productExistingImages = Array.isArray(data) ? data : [];
      if (!productExistingImages.length) {
        window.showToast('âš ï¸', 'AÃºn no hay imÃ¡genes cargadas para este producto.', 'info');
      }
      renderProductImageGallery(productId);
    } catch (err) {
      console.error('[Products] Error cargando imÃ¡genes:', err);
      gallery.innerHTML = '<p class="text-muted">No se pudieron cargar las imÃ¡genes.</p>';
      window.showToast('âŒ', err.message || 'No se pudieron cargar las imÃ¡genes.', 'error');
    }
  }

  function renderProductImageGallery(productId) {
    var gallery = document.getElementById('productImageGallery');
    if (!gallery) return;

    if (!productExistingImages.length) {
      gallery.innerHTML = '<p class="text-muted">Sin imÃ¡genes. SubÃ­ nuevas desde la secciÃ³n superior.</p>';
      return;
    }

    gallery.innerHTML = productExistingImages.map(function (img) {
      var isMain = img.es_principal === true;
      return '<div class="product-image-item' + (isMain ? ' es-principal' : '') + '" data-image-id="' + img.id + '" draggable="true">' +
        '<div class="product-image-item-preview">' +
          '<img src="' + escapeAttr(img.url) + '" alt="Producto" loading="lazy" onerror="window.imgError(this)" />' +
          '<div class="product-image-item-actions">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-action="main" title="Marcar como principal">â­ Principal</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-action="replace" title="Reemplazar imagen">ðŸ”„ Cambiar</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-action="delete" title="Eliminar">ðŸ—‘ Eliminar</button>' +
          '</div>' +
          '<input type="file" class="product-image-replace-input" accept="image/jpeg,image/png,image/webp" data-image-id="' + img.id + '" style="display:none" />' +
        '</div>' +
        '<div class="product-image-replace-preview-row" style="display:none;padding:8px;">' +
          '<img class="product-image-replace-preview" src="" alt="Preview reemplazo" />' +
          '<div style="display:flex;gap:4px;margin-top:4px;">' +
            '<button type="button" class="btn btn-sm btn-primary" data-action="confirm-replace" data-image-id="' + img.id + '">âœ“ Confirmar</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-action="cancel-replace" data-image-id="' + img.id + '">âœ• Cancelar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    bindProductImageEvents(productId);
  }

  function bindProductImageEvents(productId) {
    var gallery = document.getElementById('productImageGallery');
    if (!gallery) return;

    var items = gallery.querySelectorAll('.product-image-item');
    items.forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        draggedImageId = item.dataset.imageId;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('dragging');
        draggedImageId = null;
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!draggedImageId || draggedImageId === item.dataset.imageId) return;
        var rect = item.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          item.parentNode.insertBefore(document.querySelector('.product-image-item.dragging'), item);
        } else {
          item.parentNode.insertBefore(document.querySelector('.product-image-item.dragging'), item.nextSibling);
        }
      });
      item.addEventListener('drop', async function (e) {
        e.preventDefault();
        var ordered = Array.from(gallery.querySelectorAll('.product-image-item')).map(function (el) { return Number(el.dataset.imageId); });
        await syncImageOrder(productId, ordered);
        await loadProductImages(productId);
      });
    });

    gallery.querySelectorAll('[data-action="main"]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var item = btn.closest('.product-image-item');
        var imageId = item ? item.dataset.imageId : null;
        if (!imageId) return;
        await setMainProductImage(productId, imageId);
        await loadProductImages(productId);
      });
    });

    gallery.querySelectorAll('[data-action="replace"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.product-image-item');
        var input = item ? item.querySelector('.product-image-replace-input') : null;
        if (input) input.click();
      });
    });

    gallery.querySelectorAll('.product-image-replace-input').forEach(function (input) {
      input.addEventListener('change', async function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var imageId = input.dataset.imageId;
        await previewReplaceImage(productId, imageId, file, input);
        e.target.value = '';
      });
    });

    gallery.querySelectorAll('[data-action="confirm-replace"]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var imageId = btn.dataset.imageId;
        var item = btn.closest('.product-image-item');
        var previewImg = item ? item.querySelector('.product-image-replace-preview') : null;
        var src = previewImg ? previewImg.getAttribute('data-temp-src') : '';
        if (!src) return;
        await confirmReplaceImage(productId, imageId, src, item);
      });
    });

    gallery.querySelectorAll('[data-action="cancel-replace"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.product-image-item');
        var row = item ? item.querySelector('.product-image-replace-preview-row') : null;
        var input = item ? item.querySelector('.product-image-replace-input') : null;
        if (row) row.style.display = 'none';
        if (input) input.value = '';
      });
    });

    gallery.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.product-image-item');
        var imageId = item ? item.dataset.imageId : null;
        if (!imageId) return;
        showConfirmModal('Eliminar imagen', 'Â¿EstÃ¡s seguro de eliminar esta imagen? Esta acciÃ³n no se puede deshacer.', function () {
          deleteProductImage(productId, imageId);
        });
      });
    });
  }

  async function syncImageOrder(productId, orderedIds) {
    try {
      var res = await window.adminFetch('/api/products/' + productId + '/images/sync-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: orderedIds })
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error al sincronizar orden');
      }
    } catch (err) {
      console.error('[Products] Error sincronizando orden:', err);
      window.showToast('âŒ', err.message || 'Error al sincronizar orden', 'error');
    }
  }

  function showImageError(productId, message) {
    var el = document.getElementById('productImageError');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  function clearImageError() {
    var el = document.getElementById('productImageError');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function showImageSpinner(_productId) {
    var container = document.getElementById('productImageUploadProgress');
    if (container) {
      container.style.display = 'block';
      container.querySelector('.progress-fill').style.width = '0%';
      container.querySelector('.progress-text').textContent = '0%';
    }
  }

  function updateImageProgress(productId, percent) {
    var container = document.getElementById('productImageUploadProgress');
    if (container) {
      container.querySelector('.progress-fill').style.width = percent + '%';
      container.querySelector('.progress-text').textContent = percent + '%';
    }
  }

  function hideImageSpinner(_productId) {
    var container = document.getElementById('productImageUploadProgress');
    if (container) {
      container.style.display = 'none';
    }
  }

  function addSpinnerToImageItem(item) {
    var existing = item.querySelector('.product-image-spinner');
    if (existing) return existing;
    var spinner = document.createElement('div');
    spinner.className = 'product-image-spinner';
    item.querySelector('.product-image-item-preview').appendChild(spinner);
    return spinner;
  }

  function removeSpinnerFromImageItem(item) {
    var spinner = item.querySelector('.product-image-spinner');
    if (spinner) spinner.remove();
  }

  async function previewReplaceImage(productId, imageId, file, input) {
    var item = input ? input.closest('.product-image-item') : null;
    if (!item) return;

    clearImageError();
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    var maxSize = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      showImageError(productId, 'Formato no permitido (solo JPG, PNG, WEBP)');
      return;
    }
    if (file.size > maxSize) {
      showImageError(productId, 'Imagen muy grande (mÃ¡ximo 5MB)');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      var row = item.querySelector('.product-image-replace-preview-row');
      var preview = item.querySelector('.product-image-replace-preview');
      if (row && preview) {
        preview.setAttribute('src', e.target.result);
        preview.setAttribute('data-temp-src', e.target.result);
        row.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }

  async function confirmReplaceImage(productId, imageId, tempDataUrl, item) {
    clearImageError();
    addSpinnerToImageItem(item);

    try {
      var blob = await (await fetch(tempDataUrl)).blob();
      var formData = new FormData();
      formData.append('image', blob, 'replace_' + imageId + '.webp');

      var xhr = new XMLHttpRequest();
      var url = CONFIG.API.BASE + '/api/products/' + productId + '/images/' + imageId + '/replace';
      var token = window.getAuthToken();

      await new Promise(function (resolve, reject) {
        xhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) {
            var pct = Math.round((e.loaded / e.total) * 100);
            updateImageProgress(productId, pct);
          }
        });
        xhr.addEventListener('load', function () {
          removeSpinnerFromImageItem(item);
          hideImageSpinner(productId);
          var data = {};
          try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { data = { error: xhr.responseText }; }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(data.error || 'Error al reemplazar imagen'));
            return;
          }
          resolve(data);
        });
        xhr.addEventListener('error', function () {
          removeSpinnerFromImageItem(item);
          hideImageSpinner(productId);
          reject(new Error('Error de red'));
        });
        xhr.open('PUT', url);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(formData);
      });

      var row = item.querySelector('.product-image-replace-preview-row');
      if (row) row.style.display = 'none';
      await loadProductImages(productId);
      window.showToast('âœ…', 'Imagen reemplazada correctamente', 'success');
    } catch (err) {
      showImageError(productId, err.message || 'Error al reemplazar imagen');
      window.showToast('âŒ', err.message || 'Error al reemplazar imagen', 'error');
    }
  }

  async function deleteProductImage(productId, imageId) {
    try {
      var res = await window.adminFetch('/api/products/' + productId + '/images/' + imageId, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + window.getAuthToken() },
        credentials: 'include'
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error al eliminar');
      }
      await loadProductImages(productId);
      window.showToast('âœ…', 'Imagen eliminada', 'success');
    } catch (err) {
      window.showToast('âŒ', err.message || 'Error al eliminar', 'error');
    }
  }

  async function setMainProductImage(productId, imageId) {
    try {
      var res = await window.adminFetch('/api/products/' + productId + '/images/' + imageId, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + window.getAuthToken(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ es_principal: true })
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error al actualizar');
      }
      window.showToast('âœ…', 'Imagen principal actualizada', 'success');
    } catch (err) {
      window.showToast('âŒ', err.message || 'Error al actualizar', 'error');
    }
  }

  async function addMoreImages(productId, files) {
    if (!files.length) return;
    clearImageError();
    showImageSpinner(productId);

    var imageFormData = new FormData();
    files.forEach(function (f) { imageFormData.append('images', f); });

    try {
      var xhr = new XMLHttpRequest();
      var url = CONFIG.API.BASE + '/api/products/' + productId + '/images';
      var token = window.getAuthToken();

      await new Promise(function (resolve, reject) {
        xhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) {
            var pct = Math.round((e.loaded / e.total) * 100);
            updateImageProgress(productId, pct);
          }
        });
        xhr.addEventListener('load', function () {
          hideImageSpinner(productId);
          var data = {};
          try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { data = { error: xhr.responseText }; }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(data.error || 'Error al subir imÃ¡genes'));
            return;
          }
          resolve(data);
        });
        xhr.addEventListener('error', function () {
          hideImageSpinner(productId);
          reject(new Error('Error de red'));
        });
        xhr.open('POST', url);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(imageFormData);
      });

      await loadProductImages(productId);
      window.showToast('âœ…', 'ImÃ¡genes agregadas correctamente', 'success');
    } catch (err) {
      showImageError(productId, err.message || 'Error al subir imÃ¡genes');
      window.showToast('âŒ', err.message || 'Error al subir imÃ¡genes', 'error');
    }
  }

  /* ===== MODAL DE CONFIRMACIÃ“N ===== */
  var confirmCallback = null;

  function showConfirmModal(title, message, onConfirm) {
    var overlay = document.getElementById('confirmModalOverlay');
    var titleEl = document.getElementById('confirmModalTitle');
    var msgEl = document.getElementById('confirmModalMessage');
    if (!overlay || !titleEl || !msgEl) return;

    confirmCallback = onConfirm;
    titleEl.textContent = title || 'Confirmar';
    msgEl.textContent = message || 'Â¿EstÃ¡s seguro?';
    overlay.style.display = 'flex';
  }

  function hideConfirmModal() {
    var overlay = document.getElementById('confirmModalOverlay');
    if (overlay) overlay.style.display = 'none';
    confirmCallback = null;
  }

  if (document.getElementById('confirmModalAction')) {
    document.getElementById('confirmModalAction').addEventListener('click', function () {
      if (typeof confirmCallback === 'function') confirmCallback();
      hideConfirmModal();
    });
  }
  if (document.getElementById('cancelConfirmBtn')) {
    document.getElementById('cancelConfirmBtn').addEventListener('click', hideConfirmModal);
  }
  if (document.getElementById('closeConfirmModal')) {
    document.getElementById('closeConfirmModal').addEventListener('click', hideConfirmModal);
  }
  if (document.getElementById('confirmModalOverlay')) {
    document.getElementById('confirmModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('confirmModalOverlay')) hideConfirmModal();
    });
  }

  /* ===== MODAL ===== */

  function openProductModal() {
    var overlay = document.getElementById('productModalOverlay');
    if (overlay) overlay.style.display = 'flex';
    var btn = document.getElementById('saveProductBtn');
    if (btn) btn.disabled = false;
    clearFormValidation();

    var existingSection = document.getElementById('productExistingImagesSection');
    if (existingSection) {
      existingSection.style.display = editingProductId ? 'block' : 'none';
    }
  }

  function closeProductModal() {
    var overlay = document.getElementById('productModalOverlay');
    if (overlay) overlay.style.display = 'none';
    resetProductForm();
    clearFormValidation();
  }

  function resetProductForm() {
    editingProductId = null;
    selectedFiles = [];
    productExistingImages = [];
    draggedImageId = null;

    var form = document.getElementById('productEditForm');
    if (form) form.reset();

    var inputs = document.querySelectorAll('#productEditForm input[type="text"], #productEditForm input[type="number"], #productEditForm textarea');
    inputs.forEach(function (el) { el.value = ''; });

    var checkbox = document.getElementById('prod_active');
    if (checkbox) checkbox.checked = true;

    var featured = document.getElementById('prod_featured');
    if (featured) featured.checked = false;

    var btn = document.getElementById('saveProductBtn');
    if (btn) btn.style.display = 'block';

    var btnText = btn?.querySelector('span') || btn;
    if (btnText) btnText.textContent = 'Guardar en Nube';

    var gallery = document.getElementById('modalImageGallery');
    if (gallery) gallery.innerHTML = '';

    var existingGallery = document.getElementById('productImageGallery');
    if (existingGallery) existingGallery.innerHTML = '';

    var progress = document.getElementById('productImageUploadProgress');
    if (progress) progress.style.display = 'none';

    var errorEl = document.getElementById('productImageError');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    clearFormValidation();
  }

  /* ===== EDITAR / ELIMINAR ===== */

  window.editProduct = function (id) {
    var product = productList.find(function (p) { return p.id === id; });
    if (!product) return;

    editingProductId = id;

    (document.getElementById('prod_name') || {}).value = product.name || '';
    (document.getElementById('prod_price') || {}).value = product.price || '';
    (document.getElementById('prod_category') || {}).value = product.category || '';
    (document.getElementById('prod_description') || {}).value = product.description || '';
    (document.getElementById('prod_emoji') || {}).value = product.emoji || 'ðŸ“¿';
    (document.getElementById('prod_stock') || {}).value = product.stock || 0;
    (document.getElementById('prod_badge') || {}).value = product.badge || '';
    (document.getElementById('prod_sku') || {}).value = product.sku || '';

    var active = document.getElementById('prod_active');
    if (active) active.checked = product.active !== false;

    var btn = document.getElementById('saveProductBtn');
    if (btn) btn.style.display = 'block';

    var btnText = btn?.querySelector('span') || btn;
    if (btnText) btnText.textContent = 'Guardar en Nube';

    selectedFiles = [];
    renderImagePreviews();
    clearFormValidation();

    loadProductImages(id);
    openProductModal();
  };

  window.deleteProductConfirm = async function (id) {
    var product = productList.find(function (p) { return p.id === id; });
    if (!product) return;

    if (!confirm('Â¿EstÃ¡s seguro de eliminar el producto "' + product.name + '"?\n\nSe desactiva (soft delete) y no aparecerÃ¡ mÃ¡s en el catÃ¡logo.')) {
      return;
    }

    try {
      var res = await window.adminFetch('/api/admin/products/' + id, { method: 'DELETE' });
      if (!res || !res.ok) {
        var errMsg = 'Error al eliminar.';
        if (res) {
          var errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      window.showToast('âœ…', 'Producto eliminado correctamente.', 'success');
      await loadProducts();
    } catch (err) {
      console.error('[Products] Error eliminando:', err);
      window.showToast('âŒ', err.message || 'Error al eliminar el producto.', 'error');
    }
  };

  /* HELPERS GLOBALES */
  window.removeImagePreview = function (index) {
    selectedFiles.splice(index, 1);
    renderImagePreviews();
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function (c) {
      var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return m[c] || c;
    });
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/[&'"<>]/g, function (c) {
      var m = { '&': '&amp;', '"': '&quot;', '\'': '&#39;', '<': '&lt;', '>': '&gt;' };
      return m[c] || c;
    });
  }

  /* ===== INIT ===== */

  function initProductManager() {
    loadCategories();
    loadProducts();

    var createBtn = document.getElementById('createProductBtn');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        resetProductForm();
        openProductModal();
      });
    }

    var closeModal = document.getElementById('closeProductModal');
    if (closeModal) {
      closeModal.addEventListener('click', closeProductModal);
    }

    var cancelBtn = document.getElementById('cancelProductBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeProductModal);
    }

    var overlay = document.getElementById('productModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeProductModal();
      });
    }

     var saveBtn = document.getElementById('saveProductBtn');
     if (saveBtn) {
       saveBtn.addEventListener('click', function (e) {
         e.preventDefault();
         handleProductSubmit(e);
       });
     }

     var imageInput = document.getElementById('prod_images');
     if (imageInput) {
       imageInput.addEventListener('change', function (e) {
         var files = e.target.files;
         if (!files || !files.length) return;

         if (editingProductId) {
           addMoreImages(editingProductId, Array.from(files));
           e.target.value = '';
           return;
         }

         var totalAfter = selectedFiles.length + files.length;
         if (totalAfter > 5) {
           window.showToast('âŒ', 'MÃ¡ximo 5 imÃ¡genes por producto.', 'error');
           e.target.value = '';
           return;
         }

         Array.from(files).forEach(function (f) { selectedFiles.push(f); });
         renderImagePreviews();
         e.target.value = '';
       });
     }

     var addMoreBtn = document.getElementById('addMoreImagesBtn');
     var addMoreInput = document.getElementById('addMoreImagesInput');
     if (addMoreBtn && addMoreInput) {
       addMoreBtn.addEventListener('click', function () {
         if (!editingProductId) return;
         addMoreInput.click();
       });
       addMoreInput.addEventListener('change', function (e) {
         var files = e.target.files;
         if (!files || !files.length) return;
         if (!editingProductId) return;
         addMoreImages(editingProductId, Array.from(files));
         e.target.value = '';
       });
     }

    var dropzone = document.getElementById('productDropzone');
    if (dropzone && imageInput) {
      dropzone.addEventListener('click', function () {
        imageInput.click();
      });
      dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('drag-over');
      });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        var files = e.dataTransfer.files;
        if (!files || !files.length) return;

        if (editingProductId) {
          addMoreImages(editingProductId, Array.from(files));
          return;
        }

        var totalAfter = selectedFiles.length + files.length;
        if (totalAfter > 5) {
          window.showToast('âŒ', 'MÃ¡ximo 5 imÃ¡genes por producto.', 'error');
          return;
        }
        Array.from(files).forEach(function (f) { selectedFiles.push(f); });
        renderImagePreviews();
      });
    }

    var filterInput = document.getElementById('productFilter');
    if (filterInput) {
      filterInput.addEventListener('input', function () {
        applyProductFilters();
      });
    }

    var filterCategory = document.getElementById('filter_category');
    if (filterCategory) {
      filterCategory.addEventListener('change', function () {
        applyProductFilters();
      });
    }

    var filterActive = document.getElementById('filter_active');
    if (filterActive) {
      filterActive.addEventListener('change', function () {
        applyProductFilters();
      });
    }

    var showInactive = document.getElementById('showInactiveCheck');
    if (showInactive) {
      showInactive.addEventListener('change', function () {
        applyProductFilters();
      });
    }

    var showFeatured = document.getElementById('showFeaturedCheck');
    if (showFeatured) {
      showFeatured.addEventListener('change', function () {
        applyProductFilters();
      });
    }

    var saveCloudBtn = document.getElementById('saveProductsCloudBtn');
    if (saveCloudBtn) {
      saveCloudBtn.addEventListener('click', function () {
        if (window.saveAllProductsChanges) window.saveAllProductsChanges();
      });
    }
  }

  /* EXPORTS for admin-sync.js */
  window.initProductManager = initProductManager;
  window.reloadProducts = loadProducts;
  window.saveAllProductsChanges = async function () {
    await window.saveToCloud('products', {
      btnId: 'saveProductsCloudBtn',
      loadingId: 'saveProductsCloudBtnLoading',
      action: async function () {
        await loadProducts();
      }
    });
  };
  window.saveAllProductChanges = window.saveAllProductsChanges;
})();

