(function () {
  'use strict';

  const DROP_ZONE_CLASS = 'product-image-dropzone';
  const GALLERY_CLASS = 'product-image-gallery';
  const ITEM_CLASS = 'product-image-item';

  function init(productId) {
    if (!productId) return;
    const dropzone = document.getElementById('productImageDropzone');
    const gallery = document.getElementById('productImageGallery');
    if (!dropzone || !gallery) return;

    setupDropzone(dropzone, productId);
    loadImages(productId);
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
    images.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = ITEM_CLASS;
      item.draggable = true;
      item.dataset.id = img.id;
      item.dataset.orden = img.orden;
      item.innerHTML = `
        <div class="${ITEM_CLASS}-preview">
          <img src="${escapeHtml(img.url)}" alt="Producto" loading="lazy" />
        </div>
        <div class="${ITEM_CLASS}-actions">
          <button class="btn btn-sm btn-secondary" data-action="principal" title="Marcar como principal">${img.es_principal ? '⭐ Principal' : '⭐'}</button>
          <button class="btn btn-sm btn-danger" data-action="delete" title="Eliminar">🗑</button>
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
        const draggedId = Number(e.dataTransfer.getData('text/plain'));
        const ordered = Array.from(container.querySelectorAll(`.${ITEM_CLASS}`)).map(el => Number(el.dataset.id));
        await syncOrder(productId, ordered);
        await loadImages(productId);
      });
      item.querySelector('[data-action="principal"]')?.addEventListener('click', async () => {
        await markPrincipal(productId, img.id);
        await loadImages(productId);
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
    dropzone.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      await uploadFiles(productId, files);
    });
    const input = dropzone.querySelector('input[type="file"]');
    if (input) {
      input.addEventListener('change', async () => {
        const files = Array.from(input.files);
        if (!files.length) return;
        await uploadFiles(productId, files);
        input.value = '';
      });
    }
  }

  async function uploadFiles(productId, files) {
    const dropzone = document.getElementById('productImageDropzone');
    const status = document.getElementById('productImageUploadStatus');
    if (status) {
      status.textContent = 'Subiendo...';
      status.style.color = '#334155';
    }
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/products/${productId}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData
      }, 2, 1000);
      if (!res) throw new Error('Error de red');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      if (status) {
        status.textContent = `Subidas: ${data.images?.length || files.length}`;
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

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function getAuthToken() {
    return localStorage.getItem('ag_admin_token') || '';
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
    markPrincipal,
    deleteImage,
    syncOrder
  };
})();
