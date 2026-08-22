/* ==================== ADMIN CAROUSEL.JS ==================== */
/* Editor de carrusel de 5 slots fijos - Panel admin */

(function () {
  'use strict';

  var carouselSlots = {};
  var carouselLastSaved = {};
  var carouselPendingFiles = {};
  var carouselDirty = {};
  var currentPreviewIndex = 0;
  var previewTimer = null;

  function isSlotDirty(slot) {
    if (carouselPendingFiles[slot]) return true;
    var last = carouselLastSaved[slot];
    var current = carouselSlots[slot];
    if (!last && !current) return false;
    if (!last || !current) return true;
    var fields = ['alt_text', 'link_url', 'caption', 'about_group'];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if ((last[f] || '') !== (current[f] || '')) return true;
    }
    return false;
  }

  function isAnyDirty() {
    for (var i = 1; i <= 5; i++) {
      if (isSlotDirty(i)) return true;
    }
    return false;
  }

  function markDirty(slot) {
    carouselDirty[slot] = true;
    updateDirtyUI();
  }

  function clearDirty() {
    for (var i = 1; i <= 5; i++) {
      carouselDirty[i] = false;
      delete carouselPendingFiles[i];
    }
    updateDirtyUI();
  }

  function updateDirtyUI() {
    var indicator = document.getElementById('carouselDirtyIndicator');
    if (indicator) {
      indicator.style.display = isAnyDirty() ? 'inline' : 'none';
    }
    var btn = document.getElementById('carouselSaveAllBtn');
    if (btn) {
      btn.disabled = !isAnyDirty();
    }
  }

  function deepCloneSlots(slots) {
    var clone = {};
    for (var i = 1; i <= 5; i++) {
      if (slots[i]) {
        clone[i] = Object.assign({}, slots[i]);
      } else {
        clone[i] = null;
      }
    }
    return clone;
  }

  async function loadCarouselSlots() {
    var grid = document.getElementById('carouselSlotsGrid');
    var status = document.getElementById('carouselSaveStatus');
    if (!grid) return;

    try {
      var res = await window.adminFetch('/api/carousel', { method: 'GET' });
      if (!res || !res.ok) throw new Error('No se pudo cargar el carrusel');
      var data = await res.json();
      carouselSlots = data.slots || {};
      carouselLastSaved = deepCloneSlots(carouselSlots);
      clearDirty();
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
      var dirtyClass = isSlotDirty(i) ? ' carousel-slot-card--dirty' : '';
      html += '<div class="carousel-slot-card' + dirtyClass + '" data-slot="' + slotNum + '">' +
        '<div class="carousel-slot-thumb">' +
          (hasImage
            ? '<img src="' + escapeAttr(slot.url) + '" alt="Carrusel slot ' + slotNum + '" class="carousel-slot-img" />'
            : '<div class="carousel-slot-placeholder"><span class="carousel-slot-placeholder-icon">🖼️</span><span>Vacío</span></div>') +
        '</div>' +
        '<div class="carousel-slot-meta">' +
          '<div class="carousel-slot-header">' +
            '<span class="carousel-slot-label">Slot ' + slotNum + '</span>' +
            (hasImage ? '<span class="carousel-slot-badge">Activo</span>' : '<span class="carousel-slot-badge carousel-slot-badge--empty">Vacío</span>') +
          '</div>' +
          '<input type="text" class="carousel-slot-input" placeholder="Texto alternativo (opcional)" value="' + escapeAttr(slot.alt_text || '') + '" data-field="alt_text" />' +
          '<input type="text" class="carousel-slot-input" placeholder="URL de destino (opcional)" value="' + escapeAttr(slot.link_url || '') + '" data-field="link_url" />' +
          '<textarea class="carousel-slot-input" placeholder="Texto para el carrusel de Sobre Nosotros (opcional)" data-field="caption" rows="2">' + escapeAttr(slot.caption || '') + '</textarea>' +
          '<select class="carousel-slot-input" data-field="about_group">' +
            '<option value="0"' + (Number(slot.about_group || 0) === 0 ? ' selected' : '') + '>Sin grupo</option>' +
            '<option value="1"' + (Number(slot.about_group || 0) === 1 ? ' selected' : '') + '>Grupo 1 (fotos 1-2)</option>' +
            '<option value="2"' + (Number(slot.about_group || 0) === 2 ? ' selected' : '') + '>Grupo 2 (fotos 3-4)</option>' +
            '<option value="3"' + (Number(slot.about_group || 0) === 3 ? ' selected' : '') + '>Grupo 3 (foto 5)</option>' +
          '</select>' +
          '<div class="carousel-slot-actions">' +
            '<label class="carousel-slot-file-label">' +
              '<input type="file" accept="image/jpeg,image/png,image/webp" class="carousel-slot-file-input" data-slot="' + slotNum + '" />' +
              '<span class="btn btn-primary btn-sm">' + (hasImage ? 'Cambiar imagen' : 'Subir imagen') + '</span>' +
            '</label>' +
            (hasImage ? '<button type="button" class="btn btn-danger btn-sm" data-action="delete-slot" data-slot="' + slotNum + '">Eliminar</button>' : '') +
          '</div>' +
          '<div class="carousel-slot-save-indicator" id="carouselSlotSave_' + slotNum + '" style="display:none;"></div>' +
        '</div>' +
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
        carouselPendingFiles[slot] = file;
        markDirty(slot);
        e.target.value = '';
      });
    });

    grid.querySelectorAll('[data-action="delete-slot"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slot = Number(btn.dataset.slot);
        if (confirm('¿Estás seguro de eliminar la imagen del slot ' + slot + '?')) {
          deleteCarouselSlot(slot);
        }
      });
    });

    grid.querySelectorAll('.carousel-slot-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var slot = Number(input.closest('.carousel-slot-card').dataset.slot);
        var field = input.dataset.field;
        var value = input.value.trim();
        if (!carouselSlots[slot]) carouselSlots[slot] = {};
        carouselSlots[slot][field] = value;
        markDirty(slot);
      });
    });
  }

  async function uploadCarouselSlot(slot, file) {
    var statusEl = document.getElementById('carouselSlotSave_' + slot);

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.className = 'carousel-slot-save-indicator visible saving';
      statusEl.textContent = 'Guardando...';
    }

    try {
      var formData = new FormData();
      formData.append('image', file);
      var slotData = carouselSlots[slot] || {};
      formData.append('alt_text', slotData.alt_text || '');
      formData.append('link_url', slotData.link_url || '');
       formData.append('caption', slotData.caption || '');
       formData.append('about_group', String(slotData.about_group || 0));

       var xhr = new XMLHttpRequest();
       var uploadOrigin = (CONFIG.API && CONFIG.API.BACKEND_URL) ? CONFIG.API.BACKEND_URL : CONFIG.API.BASE;
       var url = uploadOrigin + '/api/carousel/' + slot;
       var token = window.getAuthToken();

      await new Promise(function (resolve, reject) {
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carousel_updated'));
      }
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'carousel-slot-save-indicator visible error';
        statusEl.textContent = err.message || 'Error';
        setTimeout(function () { statusEl.style.display = 'none'; }, 4000);
      }
      window.showToast('❌', err.message || 'Error al guardar imagen', 'error');
    }
  }

  async function saveCarouselMeta(slot) {
    var slotData = carouselSlots[slot] || {};
    var payload = {
      alt_text: slotData.alt_text || '',
      link_url: slotData.link_url || '',
      caption: slotData.caption || '',
      about_group: Number(slotData.about_group || 0)
    };

    var res = await window.adminFetch('/api/carousel/' + slot + '/meta', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res || !res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.error || 'Error al guardar meta del slot ' + slot);
    }

    return res.json();
  }

  async function saveAllCarouselSlots() {
    if (!isAnyDirty()) return;

    var btn = document.getElementById('carouselSaveAllBtn');
    var loading = document.getElementById('carouselSaveAllLoading');
    var status = document.getElementById('carouselSaveStatus');

    if (btn) btn.disabled = true;
    if (loading) loading.classList.remove('hidden');
    if (status) {
      status.className = 'save-status visible saving';
      status.textContent = 'Guardando cambios...';
    }

    var errors = [];
    var savedSlots = [];

    try {
      for (var i = 1; i <= 5; i++) {
        if (!isSlotDirty(i)) continue;

        if (carouselPendingFiles[i]) {
          await uploadCarouselSlot(i, carouselPendingFiles[i]);
          savedSlots.push(i);
        } else {
          try {
            await saveCarouselMeta(i);
            savedSlots.push(i);
          } catch (err) {
            errors.push('Slot ' + i + ': ' + err.message);
            console.error('[Carousel] Error guardando slot ' + i + ':', err);
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      await loadCarouselSlots();
      carouselLastSaved = deepCloneSlots(carouselSlots);
      clearDirty();

      if (status) {
        status.className = 'save-status visible success';
        status.textContent = 'Cambios guardados';
        setTimeout(function () { status.className = 'save-status'; status.textContent = ''; }, 3000);
      }
      window.showToast('✅', 'Cambios guardados', 'success');
    } catch (err) {
      if (status) {
        status.className = 'save-status visible error';
        status.textContent = err.message || 'Error al guardar';
        setTimeout(function () { status.className = 'save-status'; status.textContent = ''; }, 4000);
      }
      window.showToast('❌', err.message || 'Error al guardar los cambios', 'error');
    } finally {
      if (btn) btn.disabled = !isAnyDirty();
      if (loading) loading.classList.add('hidden');
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
      carouselLastSaved[slot] = null;
      delete carouselPendingFiles[slot];
      clearDirty();
      renderCarouselSlots();
      renderCarouselPreview();
      window.showToast('✅', 'Slot ' + slot + ' eliminado', 'success');
    } catch (err) {
      window.showToast('❌', err.message || 'Error al eliminar', 'error');
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

  window.initCarouselEditor = function () {
    loadCarouselSlots();
    var saveBtn = document.getElementById('carouselSaveAllBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveAllCarouselSlots);
    }
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
