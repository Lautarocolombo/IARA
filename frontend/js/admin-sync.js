/* ==================== ADMIN SYNC.JS ==================== */
/* Estado global de cambios pendientes y botones Guardar en Nube / Descartar */

(function () {
  'use strict';

  window.__adminDirtyState = {
    content: false,
    products: false,
    categories: false,
    testimonials: false,
    sales: false,
    orders: false
  };

  window.__adminSavedState = {
    content: null,
    products: null,
    categories: null,
    testimonials: null,
    sales: null,
    orders: null
  };

  window.__contentTabDirtyState = {
    'home-blocks': false,
    'about': false,
    'features': false,
    'process': false,
    'stats': false,
    'contact': false,
    'featured': false
  };

  var SECTION_SAVE_BUTTONS = {
    content: ['saveHomeBlocksBtn', 'saveAboutBtn', 'saveFeaturesBtn', 'saveProcessBtn', 'saveStatsBtn', 'saveContactBtn', 'saveFeaturedBtn'],
    products: ['saveProductBtn'],
    categories: ['editCategoryBtn', 'saveCategoryBtn'],
    testimonials: ['saveTestimonialBtn', 'saveSectionContentBtn'],
    orders: ['saveOrdersCloudBtn']
  };

  var SECTION_ROOTS = {
    content: 'contentEditorRoot',
    products: 'productsRoot',
    categories: 'categoriesRoot',
    testimonials: 'testimonialsRoot',
    sales: 'salesRoot',
    orders: 'ordersRoot'
  };

  /* ===== Borrador automático (anti-pérdida) =====
     Cada vez que una sección queda "dirty", a los 1.5s se guarda una foto de
     sus campos (por id) en localStorage. Si el navegador se cierra o la
     página se recarga sin guardar, al volver se ofrece recuperar el borrador.
     El borrador se borra al guardar (clearDirty) o al descartar. */

  var DRAFT_PREFIX = 'ag_draft_';
  var DRAFT_DEBOUNCE_MS = 1500;
  var draftTimers = {};

  window.__adminSavedAt = window.__adminSavedAt || {};

  function draftStorage() {
    try {
      if (typeof localStorage === 'undefined') return null;
      // Ping para detectar almacenamiento bloqueado (privado, cookies off).
      localStorage.setItem('__ag_ping', '1');
      localStorage.removeItem('__ag_ping');
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function snapshotSection(section) {
    var rootId = SECTION_ROOTS[section];
    var root = rootId ? document.getElementById(rootId) : document;
    if (!root) return null;
    var fields = root.querySelectorAll('input, textarea, select');
    var values = {};
    var count = 0;
    fields.forEach(function (f) {
      if (!f.id) return;
      var type = (f.type || '').toLowerCase();
      // Archivos, claves y ocultos no se respaldan.
      if (type === 'file' || type === 'password' || type === 'hidden') return;
      if (f.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio')) {
        values[f.id] = { c: !!f.checked };
      } else {
        values[f.id] = { v: f.value };
      }
      count++;
    });
    if (!count) return null;
    return { ts: Date.now(), section: section, values: values };
  }

  function saveDraft(section) {
    var store = draftStorage();
    if (!store) return;
    try {
      var snap = snapshotSection(section);
      if (!snap) return;
      store.setItem(DRAFT_PREFIX + section, JSON.stringify(snap));
    } catch (e) { /* cuota llena o bloqueado: el borrador es best-effort */ }
  }

  function scheduleDraft(section) {
    if (draftTimers[section]) clearTimeout(draftTimers[section]);
    draftTimers[section] = setTimeout(function () { saveDraft(section); }, DRAFT_DEBOUNCE_MS);
  }

  function clearDraft(section) {
    var store = draftStorage();
    if (!store) return;
    try { store.removeItem(DRAFT_PREFIX + section); } catch (e) { /* noop */ }
  }

  function readDraft(section) {
    var store = draftStorage();
    if (!store) return null;
    try {
      var raw = store.getItem(DRAFT_PREFIX + section);
      if (!raw) return null;
      var snap = JSON.parse(raw);
      if (!snap || !snap.values) return null;
      return snap;
    } catch (e) {
      return null;
    }
  }

  function applyDraft(snap) {
    var applied = 0;
    Object.keys(snap.values).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var saved = snap.values[id];
      try {
        if (el.tagName === 'INPUT' && ((el.type || '').toLowerCase() === 'checkbox' || (el.type || '').toLowerCase() === 'radio')) {
          el.checked = !!saved.c;
        } else if ('value' in el) {
          el.value = saved.v == null ? '' : saved.v;
        } else {
          return;
        }
        applied++;
      } catch (e) { /* noop */ }
    });
    return applied;
  }

  function offerDraftRecovery() {
    var store = draftStorage();
    if (!store) return;
    var candidates = [];
    Object.keys(window.__adminDirtyState).forEach(function (section) {
      var snap = readDraft(section);
      if (!snap) return;
      var savedAt = window.__adminSavedAt[section] || 0;
      // Solo ofrecer si el borrador es más nuevo que el último guardado.
      if (snap.ts > savedAt) candidates.push(snap);
    });
    if (!candidates.length) return;
    candidates.sort(function (a, b) { return b.ts - a.ts; });
    var newest = candidates[0];
    var when = new Date(newest.ts).toLocaleString('es-AR');
    var doRecover = function () {
      var n = applyDraft(newest);
      if (n > 0) {
        window.markDirty(newest.section);
        window.showToast('✅', 'Borrador recuperado (' + n + ' campos)', 'success');
      } else {
        clearDraft(newest.section);
      }
    };
    if (typeof window.showConfirmModal === 'function') {
      window.showConfirmModal(
        'Borrador sin guardar',
        'Hay cambios sin guardar de "' + newest.section + '" (' + when + '). ¿Recuperarlos?',
        doRecover
      );
      // Si cancela, el borrador se descarta para no preguntar siempre.
      var cancelBtn = document.getElementById('cancelConfirmBtn');
      if (cancelBtn) {
        var prev = cancelBtn.onclick;
        cancelBtn.onclick = function () {
          clearDraft(newest.section);
          if (typeof window.hideConfirmModal === 'function') window.hideConfirmModal();
          else if (typeof prev === 'function') prev();
        };
      }
    }
  }

  var SECTIONS = {
    'section-content': 'content',
    'section-products': 'products',
    'section-categories': 'categories',
    'section-testimonials': 'testimonials',
    'section-sales': 'sales',
    'section-orders': 'orders'
  };

  function getCurrentSection() {
    var active = document.querySelector('.admin-section-active');
    if (!active) return null;
    return SECTIONS[active.id] || null;
  }

  function updateUnsavedUI() {
    var indicator = document.getElementById('unsavedIndicator');
    var saveAllBtn = document.getElementById('saveAllBtn');
    var discardBtn = document.getElementById('discardChangesBtn');
    if (!indicator || !saveAllBtn || !discardBtn) return;

    var current = getCurrentSection();
    var hasDirty = current ? Object.prototype.hasOwnProperty.call(window.__adminDirtyState, current) && window.__adminDirtyState[current] : false;

    if (hasDirty) {
      indicator.style.display = 'inline-flex';
      saveAllBtn.style.display = 'inline-flex';
      discardBtn.style.display = 'inline-flex';
    } else {
      indicator.style.display = 'none';
      saveAllBtn.style.display = 'none';
      discardBtn.style.display = 'none';
    }
  }

  function updateSectionSaveButtons(section) {
    if (!section || !SECTION_SAVE_BUTTONS[section]) return;
    var hasDirty = Object.prototype.hasOwnProperty.call(window.__adminDirtyState, section) && window.__adminDirtyState[section];
    var btnIds = SECTION_SAVE_BUTTONS[section];
    btnIds.forEach(function (btnId) {
      var btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = !hasDirty;
      }
    });
  }

  function updateContentTabsDirtyState() {
    var tabs = document.querySelectorAll('.content-tab[data-content-tab]');
    tabs.forEach(function (tab) {
      var key = tab.getAttribute('data-content-tab');
      var isDirty = !!window.__contentTabDirtyState[key];
      tab.classList.toggle('has-dirty', isDirty);
    });
  }

  window.markDirty = function (section, subSection) {
    if (!section || !Object.prototype.hasOwnProperty.call(window.__adminDirtyState, section)) return;
    window.__adminDirtyState[section] = true;
    if (section === 'content' && subSection && Object.prototype.hasOwnProperty.call(window.__contentTabDirtyState, subSection)) {
      window.__contentTabDirtyState[subSection] = true;
      updateContentTabsDirtyState();
    }
    updateUnsavedUI();
    updateSectionSaveButtons(section);
    scheduleDraft(section);
  };

  window.clearDirty = function (section, subSection) {
    if (!section || !Object.prototype.hasOwnProperty.call(window.__adminDirtyState, section)) return;
    if (section === 'content' && subSection && Object.prototype.hasOwnProperty.call(window.__contentTabDirtyState, subSection)) {
      window.__contentTabDirtyState[subSection] = false;
      var anyDirty = Object.keys(window.__contentTabDirtyState).some(function(k){ return window.__contentTabDirtyState[k]; });
      window.__adminDirtyState[section] = anyDirty;
      updateContentTabsDirtyState();
      if (!anyDirty) {
        window.__adminSavedAt[section] = Date.now();
        clearDraft(section);
      }
    } else {
      window.__adminDirtyState[section] = false;
      window.__adminSavedAt[section] = Date.now();
      clearDraft(section);
    }
    updateUnsavedUI();
    updateSectionSaveButtons(section);
  };

  window.refreshUnsavedUIForSection = function () {
    updateUnsavedUI();
    var current = getCurrentSection();
    if (current) updateSectionSaveButtons(current);
  };

  window.refreshAllSaveButtons = function () {
    Object.keys(SECTION_SAVE_BUTTONS).forEach(function (section) {
      updateSectionSaveButtons(section);
    });
  };

  window.updateUnsavedUI = updateUnsavedUI;
  window.updateSectionSaveButtons = updateSectionSaveButtons;

  async function saveAllPendingChanges() {
    var current = getCurrentSection();
    if (!current || !Object.prototype.hasOwnProperty.call(window.__adminDirtyState, current) || !window.__adminDirtyState[current]) {
      window.showToast('ℹ️', 'No hay cambios pendientes en esta vista', 'info');
      return;
    }

    var btn = document.getElementById('saveAllBtn');
    var loadSpan = document.getElementById('saveAllBtnLoading');
    var textSpan = document.getElementById('saveAllBtnText');
    if (btn) btn.disabled = true;
    if (textSpan) textSpan.classList.add('hidden');
    if (loadSpan) loadSpan.classList.remove('hidden');

    try {
      switch (current) {
        case 'content':
          if (typeof window.saveAllContentSections === 'function') {
            await window.saveAllContentSections();
          } else {
            throw new Error('Función de guardado de contenido no disponible');
          }
          break;
        case 'products':
          if (typeof window.saveAllProductChanges === 'function') {
            await window.saveAllProductChanges();
          } else {
            throw new Error('Función de guardado de productos no disponible');
          }
          break;
        case 'categories':
          if (typeof window.saveAllCategoryChanges === 'function') {
            await window.saveAllCategoryChanges();
          } else {
            throw new Error('Función de guardado de categorías no disponible');
          }
          break;
        case 'testimonials':
          if (typeof window.reloadTestimonials === 'function') {
            await window.reloadTestimonials();
          } else {
            throw new Error('Función de recarga de testimonios no disponible');
          }
          break;
        case 'sales':
          if (typeof window.reloadSales === 'function') {
            await window.reloadSales();
          } else {
            throw new Error('Función de recarga de ganancias no disponible');
          }
          break;
        case 'orders':
          if (typeof window.saveAllOrdersChanges === 'function') {
            await window.saveAllOrdersChanges();
          } else {
            throw new Error('Función de guardado de pedidos no disponible');
          }
          break;
        default:
          throw new Error('Sección no reconocida');
      }

      window.__adminDirtyState[current] = false;
      updateUnsavedUI();
      window.showToast('✅', current === 'sales' ? 'Datos actualizados' : 'Todos los cambios guardados correctamente', 'success');
    } catch (err) {
      console.error('[Sync] Error guardando todos los cambios:', err);
      window.showToast('❌', err.message || 'Error al guardar los cambios', 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (loadSpan) loadSpan.classList.add('hidden');
      if (textSpan) {
        textSpan.classList.remove('hidden');
        var currentSectionForText = getCurrentSection();
        if (currentSectionForText === 'sales') {
          textSpan.textContent = 'Actualizar datos';
        } else {
          textSpan.textContent = 'Guardar en Nube';
        }
      }
    }
  }

  async function discardAllPendingChanges() {
    var current = getCurrentSection();
    if (!current || !Object.prototype.hasOwnProperty.call(window.__adminDirtyState, current) || !window.__adminDirtyState[current]) {
      window.showToast('ℹ️', 'No hay cambios pendientes para descartar', 'info');
      return;
    }

    var doDiscard = function (section) {
      var target = section || current;
      return (async function () {
        try {
      switch (target) {
        case 'content':
          if (typeof window.reloadContent === 'function') {
            await window.reloadContent();
          } else {
            throw new Error('Función de recarga de contenido no disponible');
          }
          break;
        case 'products':
          if (typeof window.reloadProducts === 'function') {
            await window.reloadProducts();
          } else {
            throw new Error('Función de recarga de productos no disponible');
          }
          break;
        case 'categories':
          if (typeof window.reloadCategories === 'function') {
            await window.reloadCategories();
          } else {
            throw new Error('Función de recarga de categorías no disponible');
          }
          break;
        case 'testimonials':
          if (typeof window.reloadTestimonials === 'function') {
            await window.reloadTestimonials();
          } else {
            throw new Error('Función de recarga de testimonios no disponible');
          }
          break;
        case 'sales':
          if (typeof window.reloadSales === 'function') {
            await window.reloadSales();
          } else {
            throw new Error('Función de recarga de ganancias no disponible');
          }
          break;
        case 'orders':
          if (typeof window.loadOrders === 'function') {
            await window.loadOrders();
          } else {
            throw new Error('Función de recarga de pedidos no disponible');
          }
          break;
        default:
          throw new Error('Sección no reconocida');
      }

      window.__adminDirtyState[section || current] = false;
      window.__adminSavedAt[section || current] = Date.now();
      clearDraft(section || current);
      updateUnsavedUI();
      window.showToast('✅', 'Cambios descartados', 'success');
    } catch (err) {
      console.error('[Sync] Error descartando cambios:', err);
      window.showToast('❌', err.message || 'Error al descartar cambios', 'error');
    }
        })();
    };

    var proceedDiscard = function () { doDiscard(current); };
    if (typeof window.showConfirmModal === 'function') {
      window.showConfirmModal('Descartar cambios', '¿Estás seguro de descartar los cambios sin guardar?', proceedDiscard);
      return;
    }
    if (window.confirm('¿Estás seguro de descartar los cambios sin guardar?')) {
      await doDiscard(current);
    }
  }

  function initSyncControls() {
    var saveAllBtn = document.getElementById('saveAllBtn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', saveAllPendingChanges);
    }

    var discardBtn = document.getElementById('discardChangesBtn');
    if (discardBtn) {
      discardBtn.addEventListener('click', discardAllPendingChanges);
    }

    window.addEventListener('beforeunload', function (e) {
      var current = getCurrentSection();
      if (current && window.__adminDirtyState[current]) {
        e.preventDefault();
        e.returnValue = 'Tenés cambios sin guardar. ¿Salir igual?';
        return e.returnValue;
      }
    });

    var originalPushState = history.pushState;
    history.pushState = function () {
      originalPushState.apply(this, arguments);
      setTimeout(updateUnsavedUI, 0);
    };

    window.addEventListener('popstate', function () {
      setTimeout(updateUnsavedUI, 0);
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    initSyncControls();
    updateUnsavedUI();
    // Ofrecer recuperar borrador (pestaña cerrada sin guardar) cuando el
    // contenido ya está cargado. Delay para no pisar la carga inicial.
    setTimeout(offerDraftRecovery, 2500);
    setTimeout(function () {
      if (typeof window.refreshAllSaveButtons === 'function') {
        window.refreshAllSaveButtons();
      }
    }, 500);
  });

  window.addEventListener('hashchange', function () {
    setTimeout(updateUnsavedUI, 0);
  });

})();
