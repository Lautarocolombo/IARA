/* ==================== ADMIN TESTIMONIALS.JS ==================== */
/* CRUD + reorden drag&drop + contenido de sección + preview en vivo */

(function () {
  'use strict';

  var testimonials = [];
  var editingId = null;
  var draggedId = null;
  var _testimonialsInit = false;
  var sectionContent = { title: '', subtitle: '' };

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ===== CONTENIDO DE SECCIÓN ===== */

  async function loadSectionContent() {
    try {
      var res = await window.adminFetch('/api/section-content/testimonials', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando contenido de sección');
      sectionContent = await res.json();
      var titleEl = document.getElementById('testimonialsSectionTitle');
      var subtitleEl = document.getElementById('testimonialsSectionSubtitle');
      if (titleEl) titleEl.value = sectionContent.title || '';
      if (subtitleEl) subtitleEl.value = sectionContent.subtitle || '';
    } catch (err) {
      console.error('[Testimonials] Error cargando contenido de sección:', err);
    }
  }

  async function saveSectionContent() {
    var titleEl = document.getElementById('testimonialsSectionTitle');
    var subtitleEl = document.getElementById('testimonialsSectionSubtitle');
    var statusEl = document.getElementById('sectionContentSaveStatus');
    var btn = document.getElementById('saveSectionContentBtn');
    var btnText = document.getElementById('saveSectionContentBtnText');
    var btnLoading = document.getElementById('saveSectionContentBtnLoading');

    var title = titleEl ? titleEl.value.trim() : '';
    var subtitle = subtitleEl ? subtitleEl.value.trim() : '';

    if (!title) {
      if (statusEl) { statusEl.textContent = 'El título es requerido'; statusEl.style.color = 'red'; }
      return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnLoading) btnLoading.classList.remove('hidden');
    if (statusEl) { statusEl.textContent = 'Guardando...'; statusEl.style.color = ''; }

    try {
      var res = await window.adminFetch('/api/admin/section-content/testimonials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, subtitle: subtitle })
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error guardando contenido');
      }
      sectionContent = await res.json();
      if (statusEl) { statusEl.textContent = 'Guardado correctamente'; statusEl.style.color = 'green'; }
      setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 3000);
    } catch (err) {
      if (statusEl) { statusEl.textContent = err.message; statusEl.style.color = 'red'; }
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.classList.remove('hidden');
      if (btnLoading) btnLoading.classList.add('hidden');
    }
  }

  /* ===== CARGA DE DATOS ===== */

  async function loadTestimonials() {
    try {
      var res = await window.adminFetch('/api/admin/testimonials', { method: 'GET' });
      if (!res || !res.ok) throw new Error('Error cargando testimonios');
      testimonials = await res.json();
      renderTestimonials();
    } catch (err) {
      console.error('[Testimonials] Error cargando:', err);
      window.showToast('❌', 'No se pudieron cargar los testimonios.', 'error');
    }
  }

  /* ===== RENDER ===== */

  function renderTestimonials() {
    var tbody = document.getElementById('testimonialsTableBody');
    var empty = document.getElementById('testimonialsEmptyState');
    if (!tbody) return;

    if (!testimonials.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = testimonials.map(function (t) {
      var stars = '';
      for (var i = 0; i < 5; i++) {
        stars += i < Number(t.rating || 0) ? '⭐' : '☆';
      }
      return '<tr data-id="' + t.id + '" draggable="true" class="testimonial-row">' +
        '<td class="text-center" style="cursor:grab;user-select:none;">☰</td>' +
        '<td>' + escapeHtml(t.name || '') + '</td>' +
        '<td>' + escapeHtml(t.role || '') + '</td>' +
        '<td>' + escapeHtml((t.comment || '').substring(0, 120)) + (t.comment && t.comment.length > 120 ? '...' : '') + '</td>' +
        '<td class="text-center">' + stars + '</td>' +
        '<td class="text-center">' +
          '<label class="toggle-field toggle-field--sm">' +
            '<span class="toggle">' +
              '<input type="checkbox" ' + (t.active !== false ? 'checked' : '') + ' onchange="window.updateTestimonialActive(' + t.id + ', this.checked)" />' +
              '<span class="toggle-slider"></span>' +
            '</span>' +
          '</label>' +
        '</td>' +
        '<td class="text-center">' +
          '<button class="btn btn-secondary btn-sm" onclick="window.editTestimonial(' + t.id + ')">Editar</button> ' +
          '<button class="btn btn-danger btn-sm" onclick="window.deleteTestimonial(' + t.id + ')">Eliminar</button>' +
        '</td>' +
      '</tr>';
    }).join('');

  }

  /* ===== DRAG & DROP REORDER ===== */

  function setupDragDrop() {
    var tbody = document.getElementById('testimonialsTableBody');
    if (!tbody) return;

    tbody.addEventListener('dragstart', function (e) {
      var row = e.target.closest('.testimonial-row');
      if (!row) return;
      draggedId = Number(row.dataset.id);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    tbody.addEventListener('dragend', function (e) {
      var row = e.target.closest('.testimonial-row');
      if (row) row.classList.remove('dragging');
      draggedId = null;
    });

    tbody.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (!draggedId) return;
      var row = e.target.closest('.testimonial-row');
      if (!row || Number(row.dataset.id) === draggedId) return;
      var rect = row.getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      var dragging = tbody.querySelector('.testimonial-row.dragging');
      if (!dragging) return;
      if (e.clientY < mid) {
        row.parentNode.insertBefore(dragging, row);
      } else {
        row.parentNode.insertBefore(dragging, row.nextSibling);
      }
    });

    tbody.addEventListener('drop', async function (e) {
      e.preventDefault();
      if (!draggedId) return;
      var rowsAfter = Array.from(tbody.querySelectorAll('.testimonial-row')).map(function (el) { return Number(el.dataset.id); });
      var orderPayload = rowsAfter.map(function (id, idx) { return { id: id, orden: idx }; });
      try {
        var res = await window.adminFetch('/api/admin/testimonials/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: orderPayload })
        });
        if (!res || !res.ok) {
          var errData = await res.json().catch(function () { return {}; });
          throw new Error(errData.error || 'Error al reordenar');
        }
        await loadTestimonials();
        window.showToast('✅', 'Orden actualizado', 'success');
      } catch (err) {
        await loadTestimonials();
        window.showToast('❌', err.message || 'Error al reordenar, se restauró el orden', 'error');
      }
    });
  }

  /* ===== CONFIRM MODAL GLOBAL ===== */

  var testimonialConfirmCallback = null;

  function showTestimonialConfirmModal(title, message, onConfirm) {
    var overlay = document.getElementById('confirmModalOverlay');
    var titleEl = document.getElementById('confirmModalTitle');
    var msgEl = document.getElementById('confirmModalMessage');
    if (!overlay || !titleEl || !msgEl) return;

    testimonialConfirmCallback = onConfirm;
    titleEl.textContent = title || 'Confirmar';
    msgEl.textContent = message || '¿Estás seguro?';
    overlay.style.display = 'flex';
  }

  function hideTestimonialConfirmModal() {
    var overlay = document.getElementById('confirmModalOverlay');
    if (overlay) overlay.style.display = 'none';
    testimonialConfirmCallback = null;
  }

  /* ===== CRUD ===== */

  function updatePreview() {
    var name = document.getElementById('testimonialName') ? document.getElementById('testimonialName').value.trim() : '';
    var role = document.getElementById('testimonialRole') ? document.getElementById('testimonialRole').value.trim() : '';
    var comment = document.getElementById('testimonialComment') ? document.getElementById('testimonialComment').value.trim() : '';
    var rating = document.getElementById('testimonialRating') ? Number(document.getElementById('testimonialRating').value) : 5;
    var photoFile = document.getElementById('testimonialPhotoFile') ? document.getElementById('testimonialPhotoFile').files[0] : null;
    var previewRow = document.getElementById('testimonialPreviewRow');
    var container = document.getElementById('testimonialLivePreview');
    if (!previewRow || !container) return;

    if (!name && !comment) {
      previewRow.style.display = 'none';
      return;
    }
    previewRow.style.display = 'block';

    var avatar = '';
    if (photoFile) {
      avatar = URL.createObjectURL(photoFile);
    } else if (editingId) {
      var t = testimonials.find(function (x) { return x.id === editingId; });
      if (t) avatar = t.avatar || t.image || '';
    }

    var stars = '';
    for (var i = 0; i < 5; i++) {
      stars += i < rating ? '⭐' : '☆';
    }

    container.innerHTML =
      '<div class="testimonial-card reveal" style="max-width:100%;">' +
        '<div class="testimonial-header">' +
          '<div class="testimonial-avatar">' + (avatar ? '<img src="' + escapeHtml(avatar) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\';this.parentElement.textContent=\'😊\'" />' : '😊') + '</div>' +
          '<div>' +
            '<div class="testimonial-name">' + escapeHtml(name || 'Nombre') + '</div>' +
            (role ? '<div style="font-size:0.8rem;color:var(--text-muted);">' + escapeHtml(role) + '</div>' : '') +
          '</div>' +
          '<div class="testimonial-rating">' + stars + '</div>' +
        '</div>' +
        '<p class="testimonial-comment">' + escapeHtml(comment || 'Comentario...') + '</p>' +
      '</div>';
  }

  /* ===== UPLOAD DE FOTO ===== */

  var pendingPhotoFile = null;

  async function uploadTestimonialPhoto() {
    var input = document.getElementById('testimonialPhotoFile');
    if (!input || !input.files[0]) return null;
    var file = input.files[0];
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    var maxSize = 2 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Formato no permitido (solo JPG, PNG, WEBP)');
    }
    if (file.size > maxSize) {
      throw new Error('Imagen muy grande (máximo 2MB)');
    }
    var formData = new FormData();
    formData.append('image', file);
    var res = await window.adminFetch('/api/admin/upload', {
      method: 'POST',
      body: formData
    });
    if (!res || !res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.error || 'Error al subir imagen');
    }
    var data = await res.json();
    return data.url || '';
  }

  function showPhotoPreview(file) {
    var container = document.getElementById('testimonialPhotoPreview');
    if (!container || !file) return;
    var url = URL.createObjectURL(file);
    container.innerHTML = '<img src="' + url + '" style="max-width: 120px; max-height: 120px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border);" />' +
      '<button type="button" class="btn btn-sm btn-secondary" id="removeTestimonialPhotoBtn" style="margin-left: 0.5rem;">Quitar</button>';
    document.getElementById('removeTestimonialPhotoBtn').addEventListener('click', function () {
      var input = document.getElementById('testimonialPhotoFile');
      if (input) input.value = '';
      container.innerHTML = '';
      pendingPhotoFile = null;
      updatePreview();
    });
  }

  /* ===== CRUD ===== */

  window.editTestimonial = function (id) {
    var t = testimonials.find(function (x) { return x.id === id; });
    if (!t) return;
    editingId = id;
    var nameEl = document.getElementById('testimonialName');
    var roleEl = document.getElementById('testimonialRole');
    var commentEl = document.getElementById('testimonialComment');
    var ratingEl = document.getElementById('testimonialRating');
    var activeEl = document.getElementById('testimonialActive');
    var saveBtn = document.getElementById('saveTestimonialBtn');
    var photoPreview = document.getElementById('testimonialPhotoPreview');
    var photoInput = document.getElementById('testimonialPhotoFile');

    if (nameEl) nameEl.value = t.name || '';
    if (roleEl) roleEl.value = t.role || '';
    if (commentEl) commentEl.value = t.comment || '';
    if (ratingEl) ratingEl.value = t.rating || 5;
    if (activeEl) activeEl.checked = t.active !== false;
    if (saveBtn) {
      saveBtn.textContent = 'Guardar cambios';
      saveBtn.dataset.editingId = id;
    }
    if (photoPreview) photoPreview.innerHTML = '';
    if (photoInput) photoInput.value = '';
    pendingPhotoFile = null;
    if (nameEl) nameEl.focus();
    updatePreview();
  };

  window.deleteTestimonial = async function (id) {
    showTestimonialConfirmModal('Eliminar testimonio', '¿Estás seguro de eliminar este testimonio? Esta acción no se puede deshacer.', function () {
      doDeleteTestimonial(id);
    });
  };

  async function doDeleteTestimonial(id) {
    try {
      var res = await window.adminFetch('/api/admin/testimonials/' + id, { method: 'DELETE' });
      if (!res || !res.ok) throw new Error('Error eliminando');
      testimonials = testimonials.filter(function (t) { return t.id !== id; });
      if (editingId === id) resetTestimonialForm();
      renderTestimonials();
      window.showToast('✅', 'Testimonio eliminado', 'success');
    } catch (err) {
      window.showToast('❌', err.message || 'Error al eliminar testimonio', 'error');
    }
  }

  window.updateTestimonialActive = async function (id, active) {
    try {
      var res = await window.adminFetch('/api/admin/testimonials/' + id + '/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: active })
      });
      if (!res || !res.ok) throw new Error('Error actualizando estado');
      var t = testimonials.find(function (x) { return x.id === id; });
      if (t) t.active = active;
    } catch (err) {
      window.showToast('❌', err.message || 'Error al actualizar estado', 'error');
      renderTestimonials();
    }
  };

  async function saveTestimonial() {
    var nameEl = document.getElementById('testimonialName');
    var roleEl = document.getElementById('testimonialRole');
    var commentEl = document.getElementById('testimonialComment');
    var ratingEl = document.getElementById('testimonialRating');
    var activeEl = document.getElementById('testimonialActive');
    var statusEl = document.getElementById('testimonialSaveStatus');
    var saveBtn = document.getElementById('saveTestimonialBtn');

    var name = nameEl ? nameEl.value.trim() : '';
    var role = roleEl ? roleEl.value.trim() : '';
    var comment = commentEl ? commentEl.value.trim() : '';
    var rating = ratingEl ? Number(ratingEl.value) : 5;
    var active = activeEl ? activeEl.checked : true;

    if (!name || !comment) {
      if (statusEl) { statusEl.textContent = 'Nombre y comentario son requeridos'; statusEl.style.color = 'red'; }
      return;
    }

    var isEdit = !!editingId;
    var url = isEdit ? '/api/admin/testimonials/' + editingId : '/api/admin/testimonials';
    var method = isEdit ? 'PUT' : 'POST';

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
    }
    if (statusEl) { statusEl.textContent = 'Guardando...'; statusEl.style.color = ''; }

    try {
      var photoUrl = '';
      var photoInput = document.getElementById('testimonialPhotoFile');
      if (photoInput && photoInput.files[0]) {
        photoUrl = await uploadTestimonialPhoto();
      } else if (isEdit) {
        var t = testimonials.find(function (x) { return x.id === editingId; });
        if (t) photoUrl = t.avatar || t.image || '';
      }

      var payload = { name: name, role: role, comment: comment, rating: rating, active: active };
      if (photoUrl) payload.avatar = photoUrl;
      if (isEdit && photoUrl) payload.image = photoUrl;

      var res = await window.adminFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res || !res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Error guardando');
      }
      var saved = await res.json();
      if (isEdit) {
        var idx = testimonials.findIndex(function (t) { return t.id === saved.id; });
        if (idx >= 0) testimonials[idx] = saved;
      } else {
        testimonials.push(saved);
        editingId = saved.id;
      }
      if (saveBtn) {
        saveBtn.textContent = 'Guardar cambios';
        saveBtn.dataset.editingId = isEdit ? editingId : saved.id;
      }
      if (statusEl) { statusEl.textContent = 'Testimonio actualizado'; statusEl.style.color = 'green'; }
      setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 3000);
      renderTestimonials();
      window.showToast('✅', 'Testimonio actualizado', 'success');
      if (window.markDirty) window.markDirty('testimonials');
    } catch (err) {
      if (statusEl) { statusEl.textContent = err.message; statusEl.style.color = 'red'; }
      window.showToast('❌', err.message || 'Error al guardar testimonio', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = editingId ? 'Guardar cambios' : 'Crear testimonio';
      }
    }
  }

  function resetTestimonialForm() {
    editingId = null;
    var nameEl = document.getElementById('testimonialName');
    var roleEl = document.getElementById('testimonialRole');
    var commentEl = document.getElementById('testimonialComment');
    var ratingEl = document.getElementById('testimonialRating');
    var activeEl = document.getElementById('testimonialActive');
    var saveBtn = document.getElementById('saveTestimonialBtn');
    var photoPreview = document.getElementById('testimonialPhotoPreview');
    var photoInput = document.getElementById('testimonialPhotoFile');
    if (nameEl) nameEl.value = '';
    if (roleEl) roleEl.value = '';
    if (commentEl) commentEl.value = '';
    if (ratingEl) ratingEl.value = 5;
    if (activeEl) activeEl.checked = true;
    if (saveBtn) {
      saveBtn.textContent = 'Crear testimonio';
      delete saveBtn.dataset.editingId;
    }
    if (photoPreview) photoPreview.innerHTML = '';
    if (photoInput) photoInput.value = '';
    pendingPhotoFile = null;
    updatePreview();
  }

  /* ===== INIT ===== */

  function initTestimonials() {
    if (_testimonialsInit) return;
    _testimonialsInit = true;
    var createBtn = document.getElementById('createTestimonialBtn');
    var saveBtn = document.getElementById('saveTestimonialBtn');
    var sectionContentBtn = document.getElementById('saveSectionContentBtn');

    if (createBtn) {
      createBtn.addEventListener('click', function () {
        resetTestimonialForm();
        var nameEl = document.getElementById('testimonialName');
        if (nameEl) nameEl.focus();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', saveTestimonial);
    }

    if (sectionContentBtn) {
      sectionContentBtn.addEventListener('click', saveSectionContent);
    }

    var formInputs = ['testimonialName', 'testimonialRole', 'testimonialComment', 'testimonialRating'];
    formInputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    var photoInput = document.getElementById('testimonialPhotoFile');
    if (photoInput) {
      photoInput.addEventListener('change', function () {
        if (photoInput.files[0]) {
          pendingPhotoFile = photoInput.files[0];
          showPhotoPreview(pendingPhotoFile);
          updatePreview();
        }
      });
    }

    setupDragDrop();

    var okBtn = document.getElementById('confirmOkBtn');
    var cancelBtn = document.getElementById('confirmCancelBtn');
    var closeBtn = document.getElementById('closeConfirmModal');
    var overlay = document.getElementById('confirmModalOverlay');

    if (okBtn) {
      okBtn.addEventListener('click', function () {
        if (typeof testimonialConfirmCallback === 'function') testimonialConfirmCallback();
        hideTestimonialConfirmModal();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', hideTestimonialConfirmModal);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', hideTestimonialConfirmModal);
    }
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) hideTestimonialConfirmModal();
      });
    }

    loadSectionContent();
    loadTestimonials();
  }

  window.initTestimonials = initTestimonials;
  window.resetTestimonialForm = resetTestimonialForm;
  window.reloadTestimonials = function () {
    resetTestimonialForm();
    loadTestimonials();
    loadSectionContent();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTestimonials);
  } else {
    initTestimonials();
  }
})();
