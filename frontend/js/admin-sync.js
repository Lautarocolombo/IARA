/* ==================== ADMIN SYNC.JS ==================== */
/* Estado global de cambios pendientes y botones Guardar en Nube / Descartar */

(function () {
  'use strict';

  window.__adminDirtyState = {
    content: false,
    products: false,
    categories: false,
    sales: false
  };

  window.__adminSavedState = {
    content: null,
    products: null,
    categories: null,
    sales: null
  };

  var SECTION_SAVE_BUTTONS = {
    content: ['saveHomeBlocksBtn', 'saveAboutBtn', 'saveFeaturesBtn', 'saveProcessBtn', 'saveStatsBtn', 'saveContactBtn', 'saveFeaturedBtn'],
    products: ['saveProductBtn'],
    categories: ['editCategoryBtn', 'saveCategoryBtn'],
    sales: ['saveSaleBtn']
  };

  var SECTIONS = {
    'section-content': 'content',
    'section-products': 'products',
    'section-categories': 'categories',
    'section-sales': 'sales'
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

  window.markDirty = function (section) {
    if (!section || !Object.prototype.hasOwnProperty.call(window.__adminDirtyState, section)) return;
    window.__adminDirtyState[section] = true;
    updateUnsavedUI();
    updateSectionSaveButtons(section);
  };

  window.clearDirty = function (section) {
    if (!section || !Object.prototype.hasOwnProperty.call(window.__adminDirtyState, section)) return;
    window.__adminDirtyState[section] = false;
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
    if (loadSpan) loadSpan.classList.remove('hidden');
    if (textSpan) textSpan.textContent = 'Guardando...';

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
        case 'sales':
          if (typeof window.reloadSales === 'function') {
            await window.reloadSales();
          } else {
            throw new Error('Función de recarga de ganancias no disponible');
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

    if (!confirm('¿Estás seguro de descartar los cambios sin guardar?')) return;

    try {
      switch (current) {
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
        case 'sales':
          if (typeof window.reloadSales === 'function') {
            await window.reloadSales();
          } else {
            throw new Error('Función de recarga de ganancias no disponible');
          }
          break;
        default:
          throw new Error('Sección no reconocida');
      }

      window.__adminDirtyState[current] = false;
      updateUnsavedUI();
      window.showToast('✅', 'Cambios descartados', 'success');
    } catch (err) {
      console.error('[Sync] Error descartando cambios:', err);
      window.showToast('❌', err.message || 'Error al descartar cambios', 'error');
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
