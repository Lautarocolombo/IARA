(function () {
  'use strict';

const ITEM_CLASS = 'product-image-item';

  let pendingFiles = [];
  let pendingMeta = { descripcion: '', categoria: '' };

  function init(productId) {
    const dropzone = document.getElementById('productImageDropzone');
    const gallery = document.getElementById('productImageGallery');
    if (!dropzone || !gallery) return;

    if (!productId) {
      pendingFiles = [];
      pendingMeta = { descripcion: '', categoria: '' };
      setupPendingDropzone(dropzone);
      gallery.innerHTML = '';
      renderPendingFileList();
      return;
    }
    setupDropzone(dropzone, productId);
    loadImages(productId);
  }

  function setupPendingDropzone(dropzone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, preventDefaults);
    });
    dropzone.addEventListener('dragenter', () => dropzone.classList.add('drag-over'));
    dropzone.addEventListener('dragover', () => dropzone.classList.add('drag-over'));
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      dropzone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      addPendingFiles(files);
    });
    const input = document.getElementById('productImageFiles');
    if (input) {
      input.addEventListener('change', () => {
        const files = Array.from(input.files);
        if (!files.length) return;
        addPendingFiles(files);
        input.value = '';
      });
    }
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function addPendingFiles(files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 200 * 1024 * 1024;
    const invalid = files.filter(f => !allowedTypes.includes(f.type));
    const oversized = files.filter(f => f.size > maxSize);
    if (invalid.length || oversized.length) {
      const msgs = [];
      if (invalid.length) msgs.push(`${invalid.length} con formato no permitido (JPG, PNG, WEBP)`);
      if (oversized.length) msgs.push(`${oversized.length} superan los 200MB`);
      showToast(msgs.join('. '), 'error');
      return;
    }
    pendingFiles = pendingFiles.concat(Array.from(files).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      file: f,
      url: URL.createObjectURL(f),
      isUrl: false
    })));
    renderPendingFileList();
  }

  function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    renderPendingFileList();
  }

  function renderPendingFileList() {
    const list = document.getElementById('productImageFilesList');
    if (!list) return;
    if (!pendingFiles.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = pendingFiles.map((f, i) => {
      const sizeText = `${(f.size / 1024).toFixed(1)} KB`;
      return `<div class="image-file-item">
        <span class="image-file-name">${escapeHtml(f.name)}</span>
        <span class="image-file-size">${sizeText}</span>
        <button type="button" class="btn btn-danger btn-sm" onclick="window.ProductImages.removePendingFile(${i})" title="Quitar">✕</button>
      </div>`;
    }).join('');
  }

  function renderPendingPreview() {
    const gallery = document.getElementById('productImageGallery');
    if (!gallery) return;
    if (!pendingFiles.length) {
      gallery.innerHTML = '<p class="empty-state">Sin imágenes</p>';
      return;
    }
    gallery.innerHTML = pendingFiles.map((f, i) => {
      const src = f.url || '';
      return `<div class="${ITEM_CLASS}">
        <div class="${ITEM_CLASS}-preview">
          <img src="${escapeHtml(src)}" alt="Imagen ${i + 1}" style="max-height:120px;width:100%;object-fit:cover;" />
        </div>
        <div class="${ITEM_CLASS}-actions">
          <button class="btn btn-sm btn-danger" onclick="window.ProductImages.removePendingFile(${i})" title="Quitar">🗑</button>
        </div>
      </div>`;
    }).join('');
  }

  async function uploadPending(productId) {
    if (!productId || !pendingFiles.length) return 0;
    const files = pendingFiles.slice();
    pendingFiles = [];
    pendingMeta = { descripcion: '', categoria: '' };
    const gallery = document.getElementById('productImageGallery');
    const filesList = document.getElementById('productImageFilesList');
    if (gallery) gallery.innerHTML = '';
    if (filesList) filesList.innerHTML = '';
    const formData = new FormData();
    let hasFiles = false;
    files.forEach(f => {
      if (f.file) {
        formData.append('images', f.file);
        hasFiles = true;
      }
    });
    if (!hasFiles) return 0;
    const xhr = new XMLHttpRequest();
    const url = `${CONFIG.API.BASE}/api/products/${productId}/images`;
    const token = getAuthToken();
    try {
      const result = await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => resolve({ status: xhr.status, data: JSON.parse(xhr.responseText || '{}') }));
        xhr.addEventListener('error', () => reject(new Error('Error de red')));
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      if (result.status < 200 || result.status >= 300) {
        throw new Error(result.data.error || 'Error al subir imágenes');
      }
      return files.length;
    } catch (err) {
      showToast(err.message, 'error');
      return 0;
    }
  }

  async function loadImages(productId) {
    const gallery = document.getElementById('productImageGallery');
    if (!gallery) return;
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images`, {}, 2, 1000);
      if (!res) throw new Error('Error de red');
      const images = await res.json();
      renderGallery(gallery, images, productId);
    } catch (err) {
      gallery.innerHTML = '<p class="empty-state">No se pudieron cargar las imágenes</p>';
    }
  }

  function renderGallery(container, images, productId) {
    container.innerHTML = '';
    if (!images.length) {
      container.innerHTML = '<p class="empty-state">Sin imágenes</p>';
      return;
    }
    images.forEach((img) => {
      const item = document.createElement('div');
      item.className = ITEM_CLASS + (img.es_principal ? ' es-principal' : '');
      item.draggable = true;
      item.dataset.id = img.id;
      item.dataset.orden = img.orden;
       item.innerHTML = `
        <div class="${ITEM_CLASS}-preview">
          <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.descripcion || 'Producto')}" loading="lazy" onerror="this.onerror=null;this.style.opacity='0.3';" />
          ${img.descripcion ? `<div class="${ITEM_CLASS}-label" title="${escapeHtml(img.descripcion)}">${escapeHtml(img.descripcion)}</div>` : ''}
          ${img.categoria ? `<span class="${ITEM_CLASS}-category cat-${img.categoria}" title="${escapeHtml(img.categoria)}">${escapeHtml(img.categoria)}</span>` : ''}
        </div>
        <div class="${ITEM_CLASS}-actions">
          <button class="btn btn-sm btn-secondary" data-action="principal" title="Marcar como principal">${img.es_principal ? '⭐ Principal' : '⭐'}</button>
          <button class="btn btn-sm btn-secondary" data-action="edit-meta" title="Editar descripción/categoría">✏️</button>
          <button class="btn btn-sm btn-secondary" data-action="replace" title="Reemplazar imagen">🔄</button>
          <button class="btn btn-sm btn-danger" data-action="delete" title="Eliminar">🗑</button>
        </div>
        <input type="file" class="${ITEM_CLASS}-replace-input" accept="image/jpeg,image/png,image/webp" data-image-id="${img.id}" style="display:none" />
        <div class="${ITEM_CLASS}-meta-form" style="display:none;padding:8px;border-top:1px dashed #f4c0d0;">
          <input type="text" class="${ITEM_CLASS}-desc-input" placeholder="Descripción" value="${escapeHtml(img.descripcion || '')}" style="width:100%;padding:4px 8px;margin-bottom:4px;font-size:0.8rem;" />
          <select class="${ITEM_CLASS}-cat-input" style="width:100%;padding:4px 8px;font-size:0.8rem;border:1.5px solid #f4c8d4;border-radius:6px;background:#fff;">
            <option value="">Sin categoría</option>
            <option value="pulseras" ${img.categoria === 'pulseras' ? 'selected' : ''}>Pulseras</option>
            <option value="accesorios" ${img.categoria === 'accesorios' ? 'selected' : ''}>Accesorios</option>
            <option value="souvenirs" ${img.categoria === 'souvenirs' ? 'selected' : ''}>Souvenirs</option>
          </select>
          <div style="display:flex;gap:4px;margin-top:4px;">
            <button class="btn btn-sm btn-secondary" data-action="save-meta">💾</button>
            <button class="btn btn-sm btn-secondary" data-action="cancel-meta">✕</button>
          </div>
        </div>
      `;
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(img.id));
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector(`.${ITEM_CLASS}.dragging`);
        if (!dragging || dragging === item) return;
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          item.parentNode.insertBefore(dragging, item);
        } else {
          item.parentNode.insertBefore(dragging, item.nextSibling);
        }
      });
      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        const ordered = Array.from(container.querySelectorAll(`.${ITEM_CLASS}`)).map(el => Number(el.dataset.id));
        await syncOrder(productId, ordered);
        await loadImages(productId);
      });
      item.querySelector('[data-action="principal"]')?.addEventListener('click', async () => {
        await markPrincipal(productId, img.id);
        await loadImages(productId);
      });
      item.querySelector('[data-action="edit-meta"]')?.addEventListener('click', () => {
        const metaForm = item.querySelector(`.${ITEM_CLASS}-meta-form`);
        if (metaForm) metaForm.style.display = 'block';
      });
      item.querySelector('[data-action="save-meta"]')?.addEventListener('click', async () => {
        const descInput = item.querySelector(`.${ITEM_CLASS}-desc-input`);
        const catInput = item.querySelector(`.${ITEM_CLASS}-cat-input`);
        await updateImageMeta(productId, img.id, {
          descripcion: descInput ? descInput.value : '',
          categoria: catInput ? catInput.value : ''
        });
        await loadImages(productId);
      });
      item.querySelector('[data-action="cancel-meta"]')?.addEventListener('click', () => {
        const metaForm = item.querySelector(`.${ITEM_CLASS}-meta-form`);
        if (metaForm) metaForm.style.display = 'none';
      });
      item.querySelector('[data-action="replace"]')?.addEventListener('click', () => {
        const input = item.querySelector(`.${ITEM_CLASS}-replace-input`);
        if (input) input.click();
      });
      item.querySelector(`.${ITEM_CLASS}-replace-input`)?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await replaceImage(productId, img.id, file, item);
        e.target.value = '';
      });
      item.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
        if (!confirm('¿Eliminar imagen?')) return;
        await deleteImage(productId, img.id);
        await loadImages(productId);
      });
      container.appendChild(item);
    });
  }

  async function setupDropzone(dropzone, productId) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, preventDefaults);
    });
    dropzone.addEventListener('dragenter', () => dropzone.classList.add('drag-over'));
    dropzone.addEventListener('dragover', () => dropzone.classList.add('drag-over'));
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      dropzone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      showMetaInputs();
      uploadFiles(productId, files);
    });
    const input = document.getElementById('productImageFiles');
    if (input) {
      input.addEventListener('change', async () => {
        const files = Array.from(input.files);
        if (!files.length) return;
        showMetaInputs();
        await uploadFiles(productId, files);
        input.value = '';
      });
    }
  }

  function showMetaInputs() {
    const metaDiv = document.querySelector('.image-meta-inputs');
    if (metaDiv) metaDiv.style.display = 'block';
  }

  async function uploadFiles(productId, files) {
    const status = document.getElementById('productImageUploadStatus');
    const progressContainer = document.getElementById('productImageUploadProgress');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 200 * 1024 * 1024;
    const invalid = files.filter(f => !allowedTypes.includes(f.type));
    const oversized = files.filter(f => f.size > maxSize);
    if (invalid.length || oversized.length) {
      const msgs = [];
      if (invalid.length) msgs.push(`${invalid.length} archivo(s) con formato no permitido (solo JPG, PNG, WEBP)`);
      if (oversized.length) msgs.push(`${oversized.length} archivo(s) superan los 200MB`);
      if (status) { status.textContent = msgs.join('. '); status.style.color = '#dc2626'; }
      showToast(msgs.join('. '), 'error');
      setTimeout(() => { if (status) status.textContent = ''; }, 4000);
      return;
    }
    if (status) {
      status.textContent = `Subiendo ${files.length} imagen(es)...`;
      status.style.color = '#334155';
    }
    if (progressContainer) {
      progressContainer.style.display = 'block';
      progressContainer.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div><div class="progress-text">0%</div>';
    }
    try {
       const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      const descInput = document.getElementById('pImageDescripcion');
      const catInput = document.getElementById('pImageCategoria');
      if (descInput && descInput.value) formData.append('descripcion', descInput.value);
      if (catInput && catInput.value) formData.append('categoria', catInput.value);
      const xhr = new XMLHttpRequest();
      const url = `${CONFIG.API.BASE}/api/products/${productId}/images`;
      const token = getAuthToken();
      const result = await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && progressContainer) {
            const pct = Math.round((e.loaded / e.total) * 100);
            const fill = progressContainer.querySelector('.progress-fill');
            const text = progressContainer.querySelector('.progress-text');
            if (fill) fill.style.width = pct + '%';
            if (text) text.textContent = pct + '%';
          }
        });
xhr.addEventListener('load', () => {
          let data = {};
          try {
            data = JSON.parse(xhr.responseText || '{}');
          } catch (e) {
            data = { error: xhr.responseText || `Error ${xhr.status}` };
          }
          resolve({ status: xhr.status, data });
        });
        xhr.addEventListener('error', () => reject(new Error('Error de red')));
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      if (result.status < 200 || result.status >= 300) {
        const msg = result.status === 403
          ? 'No autorizado para subir imágenes. Verificá tu sesión de administrador.'
          : (result.data.error || `Error ${result.status} al subir imágenes`);
        throw new Error(msg);
      }
      if (status) {
        status.textContent = `Subidas: ${result.data.images?.length || files.length}`;
        status.style.color = '#10b981';
      }
      await loadImages(productId);
    } catch (err) {
      if (status) {
        status.textContent = err.message;
        status.style.color = '#dc2626';
      }
      showToast(err.message, 'error');
    } finally {
      setTimeout(() => {
        if (status) status.textContent = '';
        if (progressContainer) {
          progressContainer.style.display = 'none';
          progressContainer.innerHTML = '';
        }
      }, 3000);
    }
  }

  async function replaceImage(productId, imageId, file) {
    const status = document.getElementById('productImageUploadStatus');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 200 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      if (status) { status.textContent = 'Formato no permitido (solo JPG, PNG, WEBP)'; status.style.color = '#dc2626'; }
      showToast('Formato no permitido', 'error');
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
      return;
    }
    if (file.size > maxSize) {
      if (status) { status.textContent = 'La imagen supera los 200MB'; status.style.color = '#dc2626'; }
      showToast('Imagen muy grande (máx 200MB)', 'error');
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
      return;
    }
    if (status) {
      status.textContent = 'Reemplazando imagen...';
      status.style.color = '#334155';
    }
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images/${imageId}/replace`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData
      }, 2, 1000);
      if (!res) throw new Error('Error de red');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reemplazar');
      if (status) {
        status.textContent = 'Imagen reemplazada';
        status.style.color = '#10b981';
      }
      await loadImages(productId);
    } catch (err) {
      if (status) {
        status.textContent = err.message;
        status.style.color = '#dc2626';
      }
      showToast(err.message, 'error');
    } finally {
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
    }
  }

  async function markPrincipal(productId, imageId) {
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images/${imageId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ es_principal: true })
      }, 2, 1000);
      if (!res) throw new Error('Error de red');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar');
      }
      showToast('Imagen principal actualizada', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function updateImageMeta(productId, imageId, meta) {
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images/${imageId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meta)
      }, 2, 1000);
      if (!res) throw new Error('Error de red');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar metadatos');
      }
      showToast('Metadatos actualizados', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteImage(productId, imageId) {
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      }, 2, 1000);
      if (!res) throw new Error('Error de red');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al eliminar');
      }
      showToast('Imagen eliminada', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function syncOrder(productId, orderedIds) {
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images/sync-order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orden: orderedIds })
      }, 2, 1000);
      if (!res) throw new Error('Error de red');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al sincronizar orden');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function getAuthToken() {
    return localStorage.getItem('ag_admin_jwt') || '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.ProductImages = {
    init,
    loadImages,
    uploadFiles,
    replaceImage,
    markPrincipal,
    updateImageMeta,
    deleteImage,
    syncOrder,
    uploadPending,
    hasPendingFiles: () => pendingFiles.length > 0,
    removePendingFile,
    renderPendingPreview,
    renderPendingFileList
  };
})();