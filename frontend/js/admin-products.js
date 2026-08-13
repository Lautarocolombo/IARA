/* ==================== ADMIN PRODUCTS.JS ==================== */
/* Modal CRUD, soft-delete, preview de imágenes */

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
      window.showToast('❌', 'No se pudieron cargar los productos.', 'error');
    } finally {
      if (empty) empty.style.display = productList.length ? 'none' : 'block';
    }
  }

  async function loadCategories() {
    var select = document.getElementById('prod_category');
    var featuredSelect = document.getElementById('featured_categories');

    try {
      var res = await window.adminFetch('/api/categories', { method: 'GET' });
      if (res && res.ok) {
        var data = await res.json();
        var items = Array.isArray(data) ? data : (data.categories || []);
        var options = items.map(function (c) {
          var name = c.name || c.slug;
          return '<option value="' + escapeAttr(c.slug) + '">' + escapeAttr(name) + '</option>';
        });
        if (select) select.innerHTML = '<option value="">Sin categoría</option>' + options.join('');

        if (featuredSelect) {
          var featuredOpts = items.map(function (c) {
            var name = c.name || c.slug;
            return '<option value="' + escapeAttr(c.slug) + '">' + escapeAttr(name) + '</option>';
          });
          featuredSelect.innerHTML = featuredOpts.join('');
        }
      } else {
        throw new Error('fallback');
      }
    } catch (err) {
      if (select) select.innerHTML =
        '<option value="">Sin categoría</option>' +
        '<option value="pulseras">Pulseras</option>' +
        '<option value="accesorios">Accesorios</option>' +
        '<option value="souvenirs">Souvenirs</option>' +
        '<option value="collares">Collares</option>';
      if (featuredSelect) featuredSelect.innerHTML =
        '<option value="pulseras">Pulseras</option>' +
        '<option value="accesorios">Accesorios</option>' +
        '<option value="souvenirs">Souvenirs</option>' +
        '<option value="collares">Collares</option>';
    }
  }

  /* ===== RENDER ===== */

  function renderProducts(products) {
    var tbody = document.getElementById('productsTableBody');
    var empty = document.getElementById('productsEmptyState');

    if (!products.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    tbody.innerHTML = products.map(function (p) {
      var imgUrl = window.getProductImageUrl(p) || '';
      var thumbnail = imgUrl
        ? '<img src="' + escapeAttr(imgUrl) + '" alt="' + escapeAttr(p.name) + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;" onerror="window.imgError(this)" />'
        : '<div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#fce8ee,#d4ede3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">' + (p.emoji || '📿') + '</div>';

      var stock = Number(p.stock || 0);
      var stockBadge = stock <= 5
        ? '<span class="badge badge-stock--low" title="Stock bajo">' + stock + ' ⚠️</span>'
        : '<span>' + stock + '</span>';

      return '<tr data-product-id="' + p.id + '">' +
        '<td><div class="product-cell">' + thumbnail +
          '<div><div class="product-name">' + escapeHtml(p.name || '') + '</div>' +
          '<div class="product-desc">' + escapeHtml((p.description || '').substring(0, 50)) + '</div></div>' +
        '</div></td>' +
        '<td>' + escapeHtml(p.category || 'Sin categoría') + '</td>' +
        '<td class="price-cell">$' + Number(p.price || 0).toLocaleString('es-AR') + '</td>' +
        '<td style="text-align:center;">' + stockBadge + '</td>' +
        '<td style="text-align:center;"><span class="badge ' + (p.active ? 'badge-stock--ok' : 'badge-stock--out') + '">' +
          (p.active ? 'Activo' : 'Inactivo') + '</span></td>' +
        '<td style="text-align:center;"><div class="actions">' +
          '<button class="btn btn-sm btn-secondary" onclick="window.editProduct(' + p.id + ')" title="Editar">✏️</button>' +
          '<button class="btn btn-sm btn-danger" onclick="window.deleteProductConfirm(' + p.id + ')" title="Eliminar">🗑</button>' +
        '</div></td></tr>';
    }).join('');
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
        '<button type="button" class="modal-image-remove" onclick="window.removeImagePreview(' + index + ')" title="Quitar">✕</button>';
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
      if (priceError) priceError.textContent = 'Ingresá un precio mayor a 0';
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

  async function handleProductSubmit(e) {
    e.preventDefault();
    if (!validateFormInline()) return;

    var form = document.getElementById('productEditForm');
    var btn = document.getElementById('saveProductBtn');
    var btnText = btn?.querySelector('span') || btn;

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = editingProductId ? 'Guardando...' : 'Creando...';

    var formData = new FormData(form);
    formData.append('name', (document.getElementById('prod_name')?.value || '').trim());
    formData.append('category', document.getElementById('prod_category')?.value || '');
    formData.append('price', document.getElementById('prod_price')?.value || '0');
    formData.append('description', document.getElementById('prod_description')?.value.trim() || '');
    formData.append('emoji', document.getElementById('prod_emoji')?.value || '📿');
    formData.append('stock', document.getElementById('prod_stock')?.value || '0');
    formData.append('featured', 'false');
    formData.append('active', document.getElementById('prod_active')?.checked ? 'true' : 'false');
    formData.append('sku', document.getElementById('prod_sku')?.value || '');
    formData.append('badge', document.getElementById('prod_badge')?.value || '');

    try {
      var res;
      var productId;

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
        var errMsg = 'Error al guardar el producto.';
        if (res) {
          var errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      var product = await res.json();
      productId = product.id || editingProductId;

      if (selectedFiles.length > 0) {
        await uploadProductImages(productId);
      }

      window.showToast('✅', 'Producto ' + (editingProductId ? 'actualizado' : 'creado') + ' correctamente.', 'success');
      closeProductModal();
      await loadProducts();
    } catch (err) {
      console.error('[Products] Error guardando:', err);
      window.showToast('❌', err.message || 'Error al guardar el producto.', 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = editingProductId ? 'Guardar cambios' : 'Crear producto';
    }
  }

  async function uploadProductImages(productId) {
    var imageFormData = new FormData();
    selectedFiles.forEach(function (file) {
      imageFormData.append('images', file);
    });

    var res = await window.adminFetch('/api/products/' + productId + '/images', {
      method: 'POST',
      body: imageFormData
    });

    if (!res || !res.ok) {
      throw new Error('No se pudieron subir las imágenes.');
    }
  }

  /* ===== MODAL ===== */

  function openProductModal() {
    var overlay = document.getElementById('productModalOverlay');
    if (overlay) overlay.style.display = 'flex';
    clearFormValidation();
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
    if (btnText) btnText.textContent = 'Crear producto';

    var gallery = document.getElementById('modalImageGallery');
    if (gallery) gallery.innerHTML = '';
    
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
    (document.getElementById('prod_emoji') || {}).value = product.emoji || '📿';
    (document.getElementById('prod_stock') || {}).value = product.stock || 0;
    (document.getElementById('prod_badge') || {}).value = product.badge || '';
    (document.getElementById('prod_sku') || {}).value = product.sku || '';

    var active = document.getElementById('prod_active');
    if (active) active.checked = product.active !== false;

    var btn = document.getElementById('saveProductBtn');
    if (btn) btn.style.display = 'block';

    var btnText = btn?.querySelector('span') || btn;
    if (btnText) btnText.textContent = 'Guardar cambios';

    selectedFiles = [];
    renderImagePreviews();
    clearFormValidation();

    openProductModal();
  };

  window.deleteProductConfirm = async function (id) {
    var product = productList.find(function (p) { return p.id === id; });
    if (!product) return;

    if (!confirm('¿Estás seguro de eliminar el producto "' + product.name + '"?\n\nSe desactiva (soft delete) y no aparecerá más en el catálogo.')) {
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

      window.showToast('✅', 'Producto eliminado correctamente.', 'success');
      await loadProducts();
    } catch (err) {
      console.error('[Products] Error eliminando:', err);
      window.showToast('❌', err.message || 'Error al eliminar el producto.', 'error');
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

        var totalAfter = selectedFiles.length + files.length;
        if (totalAfter > 5) {
          window.showToast('❌', 'Máximo 5 imágenes por producto.', 'error');
          e.target.value = '';
          return;
        }

        Array.from(files).forEach(function (f) { selectedFiles.push(f); });
        renderImagePreviews();
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
        var totalAfter = selectedFiles.length + files.length;
        if (totalAfter > 5) {
          window.showToast('❌', 'Máximo 5 imágenes por producto.', 'error');
          return;
        }
        Array.from(files).forEach(function (f) { selectedFiles.push(f); });
        renderImagePreviews();
      });
    }

    var filterInput = document.getElementById('productFilter');
    if (filterInput) {
      filterInput.addEventListener('input', function () {
        var val = (filterInput.value || '').toLowerCase();
        var filtered = productList.filter(function (p) {
          return (p.name || '').toLowerCase().indexOf(val) !== -1 ||
                 (p.category || '').toLowerCase().indexOf(val) !== -1 ||
                 (p.sku || '').toLowerCase().indexOf(val) !== -1;
        });
        renderProducts(filtered);
      });
    }

    var showInactive = document.getElementById('showInactiveCheck');
    if (showInactive) {
      showInactive.addEventListener('change', function () {
        var include = showInactive.checked;
        var filtered = include
          ? productList
          : productList.filter(function (p) { return p.active; });
        renderProducts(filtered);
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
