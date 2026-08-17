/* ==================== ADMIN CAROUSEL.JS ==================== */
/* Editor de carrusel de 5 slots fijos */

(function () {
  'use strict';

  var carouselSlots = [];
  var currentPreviewIndex = 0;
  var previewTimer = null;

  async function loadCarouselSlots() {
    var grid = document.getElementById('carouselSlotsGrid');
    var status = document.getElementById('carouselSaveStatus');
    if (!grid) return;

    try {
      var res = await window.adminFetch('/api/carousel', { method: 'GET' });
      if (!res || !res.ok) throw new Error('No se pudo cargar el carrusel');
      var data = await res.json();
      carouselSlots = data.slots || {};
      renderCarouselSlots();
      renderCarouselPreview();
    } catch (err) {
      console.error('[Carousel] Error cargando:', err);
      if (status) {
        status.className = 'save-status visible error';
        status.textContent = 'Error al cargar el carrusel';
        setTimeout(function () { status.className = 'save-status'; status.textContent = ''; }, 4000);
      }
    }
  }

  function renderCarouselSlots() {
    var grid = document.getElementById('carouselSlotsGrid');
    if (!grid) return;

    var html = '';
    for (var i = 1; i <= 5; i++) {
      var slot = carouselSlots[i];
      var hasImage = slot && slot.url;
      var slotNum = String(i);
      html += '<div class="carousel-slot-card" data-slot="' + slotNum + '">' +
        '<div class="carousel-slot-header">' +
          '<span class="carousel-slot-label">Slot ' + slotNum + '</span>' +
          (hasImage ? '<span class="carousel-slot-badge">Activo</span>' : '<span class="carousel-slot-badge carousel-slot-badge--empty">Vacío</span>') +
        '</div>' +
        '<div class="carousel-slot-preview">' +
          (hasImage
            ? '<img src="' + escapeAttr(slot.url) + '" alt="Carrusel slot ' + slotNum + '" class="carousel-slot-img" />'
            : '<div class="carousel-slot-placeholder"><span class="carousel-slot-placeholder-icon">🖼️</span><span>Vacío</span></div>') +
        '</div>' +
        (hasImage ? '<div class="carousel-slot-meta">' +
          '<input type="text" class="carousel-slot-input" placeholder="Texto alternativo (opcional)" value="' + escapeAttr(slot.alt_text || '') + '" data-field="alt_text" />' +
          '<input type="text" class="carousel-slot-input" placeholder="URL de destino (opcional)" value="' + escapeAttr(slot.link_url || '') + '" data-field="link_url" />' +
        '</div>' : '') +
        '<div class="carousel-slot-actions">' +
          '<label class="carousel-slot-file-label">' +
            '<input type="file" accept="image/jpeg,image/png,image/webp" class="carousel-slot-file-input" data-slot="' + slotNum + '" />' +
            '<span class="btn btn-primary btn-sm">' + (hasImage ? 'Cambiar imagen' : 'Subir imagen') + '</span>' +
          '</label>' +
          (hasImage ? '<button type="button" class="btn btn-danger btn-sm" data-action="delete-slot" data-slot="' + slotNum + '">Eliminar</button>' : '') +
        '</div>' +
        '<div class="carousel-slot-save-indicator" id="carouselSlotSave_' + slotNum + '" style="display:none;"></div>' +
      '</div>';
    }

    grid.innerHTML = html;
    bindCarouselSlotEvents();
  }

  function bindCarouselSlotEvents() {
    var grid = document.getElementById('carouselSlotsGrid');
    if (!grid) return;

    grid.querySelectorAll('.carousel-slot-file-input').forEach(function (input) {
      input.addEventListener('change', function (e) {
        var slot = Number(input.dataset.slot);
        var file = e.target.files[0];
        if (!file) return;
        uploadCarouselSlot(slot, file, input);
        e.target.value = '';
      });
    });

    grid.querySelectorAll('[data-action="delete-slot"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slot = Number(btn.dataset.slot);
        showConfirmModal('Eliminar imagen', '¿Estás seguro de eliminar la imagen del slot ' + slot + '?', function () {
          deleteCarouselSlot(slot);
        });
      });
    });

    grid.querySelectorAll('.carousel-slot-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var slot = Number(input.closest('.carousel-slot-card').dataset.slot);
        var field = input.dataset.field;
        var value = input.value.trim();
        updateCarouselSlotMeta(slot, field, value);
      });
    });
  }

  async function uploadCarouselSlot(slot, file, inputEl) {
    var statusEl = document.getElementById('carouselSlotSave_' + slot);
    var card = inputEl ? inputEl.closest('.carousel-slot-card') : null;
    var previewContainer = card ? card.querySelector('.carousel-slot-preview') : null;

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.className = 'carousel-slot-save-indicator visible saving';
      statusEl.textContent = 'Guardando...';
    }

    try {
      var formData = new FormData();
      formData.append('image', file);
      var altInput = card ? card.querySelector('[data-field="alt_text"]') : null;
      var linkInput = card ? card.querySelector('[data-field="link_url"]') : null;
      if (altInput) formData.append('alt_text', altInput.value || '');
      if (linkInput) formData.append('link_url', linkInput.value || '');

      var xhr = new XMLHttpRequest();
      var url = CONFIG.API.BASE + '/api/carousel/' + slot;
      var token = window.getAuthToken();

      var result = await new Promise(function (resolve, reject) {
        xhr.addEventListener('load', function () {
          var data = {};
          try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { data = { error: xhr.responseText }; }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(data.error || 'Error al guardar'));
            return;
          }
          resolve(data);
        });
        xhr.addEventListener('error', function () { reject(new Error('Error de red')); });
        xhr.open('PUT', url);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(formData);
      });

      if (statusEl) {
        statusEl.className = 'carousel-slot-save-indicator visible success';
        statusEl.textContent = 'Guardado';
        setTimeout(function () { statusEl.style.display = 'none'; }, 2000);
      }

      await loadCarouselSlots();
      window.showToast('✅', 'Imagen del slot ' + slot + ' guardada', 'success');
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'carousel-slot-save-indicator visible error';
        statusEl.textContent = err.message || 'Error';
        setTimeout(function () { statusEl.style.display = 'none'; }, 4000);
      }
      window.showToast('❌', err.message || 'Error al guardar imagen', 'error');
    }
  }

  async function deleteCarouselSlot(slot) {
    try {
      var res = await window.adminFetch('/api/carousel/' + slot, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + window.getAuthToken() },
        credentials: 'include'
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error al eliminar');
      }
      carouselSlots[slot] = null;
      renderCarouselSlots();
      renderCarouselPreview();
      window.showToast('✅', 'Slot ' + slot + ' eliminado', 'success');
    } catch (err) {
      window.showToast('❌', err.message || 'Error al eliminar', 'error');
    }
  }

  async function updateCarouselSlotMeta(slot, field, value) {
    try {
      var formData = new FormData();
      formData.append(field, value);
      var xhr = new XMLHttpRequest();
      var url = CONFIG.API.BASE + '/api/carousel/' + slot;
      var token = window.getAuthToken();

      await new Promise(function (resolve, reject) {
        xhr.addEventListener('load', function () {
          var data = {};
          try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { data = { error: xhr.responseText }; }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(data.error || 'Error'));
            return;
          }
          resolve(data);
        });
        xhr.addEventListener('error', function () { reject(new Error('Error de red')); });
        xhr.open('PUT', url);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(formData);
      });

      carouselSlots[slot] = carouselSlots[slot] || {};
      carouselSlots[slot][field] = value;
      renderCarouselPreview();
    } catch (err) {
      window.showToast('❌', 'Error al actualizar texto: ' + err.message, 'error');
    }
  }

  function renderCarouselPreview() {
    var container = document.getElementById('carouselPreviewContainer');
    var dotsContainer = document.getElementById('carouselPreviewDots');
    if (!container || !dotsContainer) return;

    var slides = [];
    for (var i = 1; i <= 5; i++) {
      var slot = carouselSlots[i];
      if (slot && slot.url) {
        slides.push(slot);
      }
    }

    if (!slides.length) {
      container.innerHTML = '<div class="carousel-preview-slide active"><div class="carousel-slot-placeholder"><span class="carousel-slot-placeholder-icon">🖼️</span><span>Sin imágenes</span></div></div>';
      dotsContainer.innerHTML = '';
      return;
    }

    currentPreviewIndex = Math.min(currentPreviewIndex, slides.length - 1);
    if (currentPreviewIndex < 0) currentPreviewIndex = 0;

    container.innerHTML = slides.map(function (slot, idx) {
      return '<div class="carousel-preview-slide' + (idx === currentPreviewIndex ? ' active' : '') + '" data-preview-index="' + idx + '">' +
        '<img src="' + escapeAttr(slot.url) + '" alt="' + escapeAttr(slot.alt_text || 'Preview') + '" class="carousel-preview-img" />' +
      '</div>';
    }).join('');

    dotsContainer.innerHTML = slides.map(function (_, idx) {
      return '<button type="button" class="carousel-preview-dot' + (idx === currentPreviewIndex ? ' active' : '') + '" data-preview-index="' + idx + '" aria-label="Slide ' + (idx + 1) + '"></button>';
    }).join('');

    dotsContainer.querySelectorAll('.carousel-preview-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        currentPreviewIndex = Number(dot.dataset.previewIndex);
        renderCarouselPreview();
      });
    });

    startPreviewAutoplay();
  }

  function startPreviewAutoplay() {
    if (previewTimer) clearInterval(previewTimer);
    var slides = [];
    for (var i = 1; i <= 5; i++) {
      var slot = carouselSlots[i];
      if (slot && slot.url) slides.push(slot);
    }
    if (slides.length <= 1) return;
    previewTimer = setInterval(function () {
      currentPreviewIndex = (currentPreviewIndex + 1) % slides.length;
      renderCarouselPreview();
    }, 4000);
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/[&'"<>]/g, function (c) {
      var m = { '&': '&amp;', '"': '&quot;', '\'': '&#39;', '<': '&lt;', '>': '&gt;' };
      return m[c] || c;
    });
  }

  /* ===== MODAL DE CONFIRMACIÓN (reutiliza el existente) ===== */
  var confirmCallback = null;

  function showConfirmModal(title, message, onConfirm) {
    var overlay = document.getElementById('confirmModalOverlay');
    var titleEl = document.getElementById('confirmModalTitle');
    var msgEl = document.getElementById('confirmModalMessage');
    if (!overlay || !titleEl || !msgEl) return;

    confirmCallback = onConfirm;
    titleEl.textContent = title || 'Confirmar';
    msgEl.textContent = message || '¿Estás seguro?';
    overlay.style.display = 'flex';
  }

  if (document.getElementById('confirmOkBtn')) {
    document.getElementById('confirmOkBtn').addEventListener('click', function () {
      if (typeof confirmCallback === 'function') confirmCallback();
      confirmCallback = null;
    });
  }
  if (document.getElementById('confirmCancelBtn')) {
    document.getElementById('confirmCancelBtn').addEventListener('click', function () { confirmCallback = null; });
  }
  if (document.getElementById('closeConfirmModal')) {
    document.getElementById('closeConfirmModal').addEventListener('click', function () { confirmCallback = null; });
  }
  if (document.getElementById('confirmModalOverlay')) {
    document.getElementById('confirmModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('confirmModalOverlay')) confirmCallback = null;
    });
  }

  window.initCarouselEditor = function () {
    loadCarouselSlots();
  };

  window.reloadCarousel = loadCarouselSlots;

  if (typeof window !== 'undefined') {
    window.addEventListener('dashboard:section-changed', function (e) {
      if (e.detail && e.detail.section === 'carousel') {
        if (typeof window.reloadCarousel === 'function') window.reloadCarousel();
      }
    });
  }
})();
