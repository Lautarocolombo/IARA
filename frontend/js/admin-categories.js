/* ==================== ADMIN CATEGORIES.JS ==================== */
/* CRUD de categorías: crear, renombrar, reordenar, desactivar */

(function () {
  'use strict';

  var categoriesCache = [];
  var saving = false;

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

  function setLoading(btnId, loadingId, loading) {
    var btn = document.getElementById(btnId);
    var load = document.getElementById(loadingId);
    if (btn) btn.disabled = loading;
    if (load) load.classList.toggle('hidden', !loading);
    var textSpan = load ? load.previousElementSibling : null;
    if (textSpan && textSpan.id === btnId + 'Text') {
      textSpan.textContent = loading ? 'Guardando...' : 'Guardar cambios';
    }
  }

  async function loadCategories() {
    try {
      var res = await window.adminFetch('/api/admin/categories', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando categorías');
      categoriesCache = await res.json();
      renderCategories();
      populateParentSelect();
    } catch (err) {
      console.error('[Categories] Error:', err);
      showToast('❌', err.message || 'Error al cargar categorías', 'error');
    }
  }

  function populateParentSelect() {
    var select = document.getElementById('cat_parent_id');
    if (!select) return;
    var html = '<option value="">Ninguna (categoría principal)</option>';
    categoriesCache.forEach(function (c) {
      html += '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    });
    select.innerHTML = html;
  }

  function renderCategories() {
    var container = document.getElementById('categoriesTree');
    var empty = document.getElementById('categoriesEmptyState');
    if (!container) return;

    if (!categoriesCache.length) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    var parents = categoriesCache.filter(function (c) { return !c.parent_id; });
    var childrenByParent = {};
    categoriesCache.forEach(function (c) {
      if (c.parent_id) {
        if (!childrenByParent[c.parent_id]) childrenByParent[c.parent_id] = [];
        childrenByParent[c.parent_id].push(c);
      }
    });

    function renderCategoryItem(cat, depth) {
      var children = childrenByParent[cat.id] || [];
      var padding = Math.min(depth * 20, 60);
      var html = '<div class="category-tree-item" style="margin-left:' + padding + 'px;" data-id="' + cat.id + '">' +
        '<div class="category-tree-header">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<span style="font-size:1.1rem;">' + (cat.emoji || '📁') + '</span>' +
            '<div>' +
              '<div class="product-name">' + escapeHtml(cat.name) + '</div>' +
              '<div class="product-desc">' + escapeHtml(cat.slug || '') + ' · ' + (cat.product_count || 0) + ' productos</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.4rem;">' +
            '<label class="testimonial-active-toggle" style="transform:scale(0.9);">' +
              '<input type="checkbox" ' + (cat.active ? 'checked' : '') + ' onchange="window.toggleCategory(' + cat.id + ', ' + (cat.active ? 'false' : 'true') + ')" />' +
              '<span class="slider"></span>' +
            '</label>' +
            '<button class="btn btn-secondary btn-sm" onclick="window.editCategory(' + cat.id + ')">✏️</button>' +
            '<button class="btn btn-danger btn-sm" onclick="window.confirmDeleteCategory(' + cat.id + ')" ' + ((cat.product_count || 0) > 0 ? 'disabled title="Tiene productos asociados"' : '') + '>🗑️</button>' +
          '</div>' +
        '</div>';
      if (children.length) {
        html += '<div class="category-tree-children">';
        children.forEach(function (child) {
          html += renderCategoryItem(child, depth + 1);
        });
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    var html = '';
    parents.forEach(function (parent) {
      html += renderCategoryItem(parent, 0);
    });
    container.innerHTML = html;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.moveCategory = async function (id, direction) {
    var idx = categoriesCache.findIndex(function (c) { return c.id === id; });
    if (idx < 0) return;
    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= categoriesCache.length) return;

    var items = categoriesCache.slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    var currentOrder = items[idx].orden || 0;
    var targetOrder = items[newIdx].orden || 0;
    items[idx].orden = targetOrder;
    items[newIdx].orden = currentOrder;

    var payload = items.map(function (c) { return { id: c.id, orden: c.orden }; });
    try {
      var res = await window.adminFetch('/api/admin/categories/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: payload })
      });
      if (!res || !res.ok) throw new Error('Error reordenando');
      await loadCategories();
      showToast('✅', 'Orden actualizado', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al reordenar', 'error');
    }
  };

  window.toggleCategory = async function (id, active) {
    try {
      var res = await window.adminFetch('/api/admin/categories/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: active })
      });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error actualizando estado');
      }
      await loadCategories();
      showToast('✅', 'Categoría actualizada', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al actualizar', 'error');
    }
  };

  window.editCategory = function (id) {
    var cat = categoriesCache.find(function (c) { return c.id === id; });
    if (!cat) return;
    openCategoryModal(cat);
  };

  window.confirmDeleteCategory = function (id) {
    var cat = categoriesCache.find(function (c) { return c.id === id; });
    if (!cat) return;
    var overlay = document.getElementById('confirmModalOverlay');
    var msg = document.getElementById('confirmModalMessage');
    var confirmBtn = document.getElementById('confirmModalAction');
    if (!overlay || !msg || !confirmBtn) return;

    msg.textContent = '¿Seguro que querés eliminar la categoría "' + cat.name + '"? Esta acción no se puede deshacer.';
    confirmBtn.textContent = 'Eliminar';
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.onclick = function () {
      deleteCategory(id);
      closeConfirmModal();
    };
    openConfirmModal();
  };

  async function deleteCategory(id) {
    try {
      var res = await window.adminFetch('/api/admin/categories/' + id, { method: 'DELETE' });
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error eliminando categoría');
      }
      await loadCategories();
      showToast('✅', 'Categoría eliminada', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al eliminar', 'error');
    }
  }

  function openCategoryModal(category) {
    var modal = document.getElementById('categoryModalOverlay');
    var form = document.getElementById('categoryForm');
    var title = document.getElementById('categoryModalTitle');
    if (!modal || !form) return;

    if (title) title.textContent = category ? 'Editar categoría' : 'Nueva categoría';
    form.dataset.editId = category ? category.id : '';
    form.dataset.imageUrl = category ? (category.image_url || '') : '';
    document.getElementById('cat_name').value = category ? category.name : '';
    document.getElementById('cat_slug').value = category ? category.slug : '';
    document.getElementById('cat_description').value = category ? (category.description || '') : '';
    document.getElementById('cat_emoji').value = category ? (category.emoji || '') : '';
    document.getElementById('cat_active').checked = category ? !!category.active : true;

    var parentSelect = document.getElementById('cat_parent_id');
    if (parentSelect) {
      parentSelect.value = category && category.parent_id ? String(category.parent_id) : '';
      var options = parentSelect.querySelectorAll('option');
      options.forEach(function (opt) {
        if (category && opt.value === String(category.id)) {
          opt.disabled = true;
        } else {
          opt.disabled = false;
        }
      });
    }

    var preview = document.getElementById('cat_image_preview');
    if (preview) {
      if (category && category.image_url) {
        preview.innerHTML = '<img src="' + escapeHtml(category.image_url) + '" style="max-height:120px;border-radius:8px;" />';
      } else {
        preview.innerHTML = '';
      }
    }

    var fileInput = document.getElementById('cat_image_file');
    if (fileInput) fileInput.value = '';

    modal.classList.add('active');

    var catInputs = form.querySelectorAll('input, textarea, select');
    catInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        if (window.markDirty) window.markDirty('categories');
      });
      input.addEventListener('change', function () {
        if (window.markDirty) window.markDirty('categories');
      });
    });
  }

  function closeCategoryModal() {
    var modal = document.getElementById('categoryModalOverlay');
    if (modal) modal.classList.remove('active');
  }

  async function saveCategory() {
    if (saving) return;
    saving = true;
    var editId = document.getElementById('categoryForm').dataset.editId;
    var btnId = editId ? 'editCategoryBtn' : 'createCategoryBtn';
    var loadId = btnId + 'Loading';
    setLoading(btnId, loadId, true);

    var payload = {
      name: document.getElementById('cat_name').value.trim(),
      slug: document.getElementById('cat_slug').value.trim(),
      description: document.getElementById('cat_description').value.trim(),
      emoji: document.getElementById('cat_emoji').value.trim(),
      active: document.getElementById('cat_active').checked,
      parent_id: document.getElementById('cat_parent_id') ? document.getElementById('cat_parent_id').value || null : null
    };

    if (payload.parent_id === '') payload.parent_id = null;

    if (!payload.name || !payload.slug) {
      showToast('❌', 'Nombre y slug son requeridos', 'error');
      setLoading(btnId, loadId, false);
      saving = false;
      return;
    }

    var fileInput = document.getElementById('cat_image_file');
    var formData = null;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      formData = new FormData();
      formData.append('image', fileInput.files[0]);
    }

    try {
      var url = editId ? '/api/admin/categories/' + editId : '/api/admin/categories';
      var method = editId ? 'PUT' : 'POST';
      var res;
      if (formData) {
        res = await window.adminFetch(url, {
          method: method,
          body: formData
        });
      } else {
        res = await window.adminFetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (!res || !res.ok) {
        var data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || 'Error guardando categoría');
      }
      var saved = await res.json().catch(function () { return null; });
      if (saved && saved.image_url) {
        payload.image_url = saved.image_url;
      }
      closeCategoryModal();
      await loadCategories();
      if (window.clearDirty) window.clearDirty('categories');
      showToast('✅', editId ? 'Categoría actualizada' : 'Categoría creada', 'success');
    } catch (err) {
      showToast('❌', err.message || 'Error al guardar', 'error');
    } finally {
      setLoading(btnId, loadId, false);
      saving = false;
    }
  }

  function openConfirmModal() {
    var overlay = document.getElementById('confirmModalOverlay');
    if (overlay) overlay.classList.add('active');
  }

  function closeConfirmModal() {
    var overlay = document.getElementById('confirmModalOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function initCategoryManager() {
    loadCategories();

    var createBtn = document.getElementById('createCategoryBtn');
    if (createBtn) createBtn.addEventListener('click', function () { openCategoryModal(null); });

    var saveBtn = document.getElementById('saveCategoryBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveCategory);

    var closeBtn = document.getElementById('closeCategoryModal');
    if (closeBtn) closeBtn.addEventListener('click', closeCategoryModal);

    var cancelConfirm = document.getElementById('cancelConfirmBtn');
    if (cancelConfirm) cancelConfirm.addEventListener('click', closeConfirmModal);

    var imageInput = document.getElementById('cat_image_file');
    if (imageInput) {
      imageInput.addEventListener('change', function () {
        var file = this.files[0];
        var preview = document.getElementById('cat_image_preview');
        if (file && preview) {
          var reader = new FileReader();
          reader.onload = function (e) {
            preview.innerHTML = '<img src="' + e.target.result + '" style="max-height:120px;border-radius:8px;" />';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    var overlay = document.getElementById('categoryModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeCategoryModal();
      });
    }

    var confirmOverlay = document.getElementById('confirmModalOverlay');
    if (confirmOverlay) {
      confirmOverlay.addEventListener('click', function (e) {
        if (e.target === confirmOverlay) closeConfirmModal();
      });
    }
  }

  window.initCategoryManager = initCategoryManager;
  window.editCategory = window.editCategory;
  window.confirmDeleteCategory = window.confirmDeleteCategory;
  window.moveCategory = window.moveCategory;
  window.toggleCategory = window.toggleCategory;
  window.saveCategory = saveCategory;
  window.reloadCategories = loadCategories;
  window.saveAllCategoryChanges = async function () {
    if (window.__adminDirtyState && window.__adminDirtyState.categories && typeof window.saveCategory === 'function') {
      await window.saveCategory();
    }
  };
  window.discardAllCategoryChanges = loadCategories;
})();
