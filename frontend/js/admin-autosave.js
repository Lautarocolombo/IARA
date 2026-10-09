/* ==================== ADMIN AUTOSAVE.JS ==================== */
/* Guardado unificado con debounce, cola de reintentos, indicador único */

(function () {
  'use strict';

  var AUTOSAVE_DEBOUNCE_MS = 2000;
  var MAX_RETRIES = 5;
  var RETRY_BASE_DELAY_MS = 3000;

  var saveQueue = [];
  var saveTimers = {};
  var isSaving = false;
  var isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  var statusElements = {
    text: null,
    icon: null,
    container: null
  };

  var sectionSaveFns = {
    content: null,
    products: null,
    categories: null,
    testimonials: null,
    sales: null,
    orders: null,
    payments: null,
    users: null,
    earnings: null
  };

  function initStatusElements() {
    statusElements.container = document.getElementById('autosaveStatus');
    if (statusElements.container) {
      statusElements.text = statusElements.container.querySelector('.autosave-text');
      statusElements.icon = statusElements.container.querySelector('.autosave-icon');
    }
  }

  function setStatus(state, message) {
    if (!statusElements.container) initStatusElements();
    if (!statusElements.container) return;

    statusElements.container.className = 'autosave-status ' + state;
    statusElements.container.setAttribute('data-state', state);

    var icons = {
      saved: '✅',
      saving: '⏳',
      dirty: '⚠️',
      error: '❌',
      offline: '📴',
      retrying: '🔄'
    };

    if (statusElements.icon) statusElements.icon.textContent = icons[state] || icons.dirty;
    if (statusElements.text) statusElements.text.textContent = message || getDefaultMessage(state);
    statusElements.container.style.display = 'flex';
  }

  function getDefaultMessage(state) {
    var messages = {
      saved: 'Guardado',
      saving: 'Guardando...',
      dirty: 'Cambios sin guardar',
      error: 'Error al guardar - Reintentando...',
      offline: 'Sin conexión - Guardando localmente',
      retrying: 'Reintentando...'
    };
    return messages[state] || 'Desconocido';
  }

  function registerSaveFunction(section, fn) {
    if (fn && typeof fn === 'function') {
      sectionSaveFns[section] = fn;
    }
  }

  function getSaveFunction(section) {
    return sectionSaveFns[section] || (window['saveAll' + capitalize(section) + 'Changes'] || null);
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function debouncedSave(section) {
    if (saveTimers[section]) clearTimeout(saveTimers[section]);
    saveTimers[section] = setTimeout(function () {
      enqueueSave(section);
    }, AUTOSAVE_DEBOUNCE_MS);
    setStatus('dirty', 'Cambios sin guardar');
  }

  function enqueueSave(section) {
    var fn = getSaveFunction(section);
    if (!fn) {
      console.warn('[Autosave] No save function for section:', section);
      return;
    }

    var queueItem = {
      section: section,
      fn: fn,
      retries: 0,
      timestamp: Date.now()
    };

    saveQueue.push(queueItem);
    processQueue();
  }

  async function processQueue() {
    if (isSaving || saveQueue.length === 0) return;
    if (!isOnline) {
      setStatus('offline', 'Sin conexión - Guardando localmente');
      return;
    }

    isSaving = true;
    setStatus('saving', 'Guardando...');

    while (saveQueue.length > 0) {
      var item = saveQueue[0];
      try {
        await item.fn();
        saveQueue.shift();
        if (window.clearDirty) window.clearDirty(item.section);
        setStatus('saved', 'Guardado');
      } catch (err) {
        console.error('[Autosave] Error saving', item.section, err);
        item.retries++;
        if (item.retries >= MAX_RETRIES) {
          saveQueue.shift();
          setStatus('error', 'Error al guardar ' + item.section + ' - MÁX reintentos');
          window.showToast('❌', 'Error guardando ' + item.section + ': ' + err.message, 'error');
        } else {
          var delay = RETRY_BASE_DELAY_MS * Math.pow(2, item.retries - 1);
          setStatus('retrying', 'Reintentando ' + item.section + ' (' + item.retries + '/' + MAX_RETRIES + ') en ' + Math.round(delay / 1000) + 's...');
          await new Promise(resolve => setTimeout(resolve, delay));
          if (!isOnline) {
            setStatus('offline', 'Sin conexión - Guardando localmente');
            isSaving = false;
            return;
          }
        }
      }
    }

    isSaving = false;
    if (saveQueue.length === 0) {
      setStatus('saved', 'Guardado');
    }
  }

  function saveAllSections() {
    var dirtySections = Object.keys(sectionSaveFns).filter(function (s) {
      return window.__adminDirtyState && window.__adminDirtyState[s];
    });

    if (dirtySections.length === 0) {
      window.showToast('ℹ️', 'No hay cambios pendientes', 'info');
      return Promise.resolve();
    }

    var btn = document.getElementById('saveAllBtn');
    var textSpan = document.getElementById('saveAllBtnText');
    var loadSpan = document.getElementById('saveAllBtnLoading');
    if (btn) btn.disabled = true;
    if (textSpan) textSpan.style.display = 'none';
    if (loadSpan) loadSpan.classList.remove('hidden');
    setStatus('saving', 'Guardando todo...');

    var promises = dirtySections.map(function (section) {
      var fn = getSaveFunction(section);
      return fn ? fn() : Promise.resolve();
    });

    return Promise.all(promises)
      .then(function () {
        dirtySections.forEach(function (s) { if (window.clearDirty) window.clearDirty(s); });
        setStatus('saved', 'Todo guardado');
        window.showToast('✅', 'Todos los cambios guardados correctamente', 'success');
      })
      .catch(function (err) {
        console.error('[Autosave] Error en saveAll:', err);
        setStatus('error', 'Error al guardar: ' + err.message);
        window.showToast('❌', 'Error al guardar: ' + err.message, 'error');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
        if (textSpan) textSpan.style.display = '';
        if (loadSpan) loadSpan.classList.add('hidden');
      });
  }

  function markDirty(section, subSection) {
    if (!window.__adminDirtyState) window.__adminDirtyState = {};
    window.__adminDirtyState[section] = true;
    if (subSection && window.__contentTabDirtyState) {
      window.__contentTabDirtyState[subSection] = true;
    }
    debouncedSave(section);
    if (window.updateUnsavedUI) window.updateUnsavedUI();
    if (window.updateSectionSaveButtons) window.updateSectionSaveButtons(section);
  }

  function clearDirty(section, subSection) {
    if (!window.__adminDirtyState) return;
    if (subSection && window.__contentTabDirtyState) {
      window.__contentTabDirtyState[subSection] = false;
      var anyDirty = Object.keys(window.__contentTabDirtyState).some(function (k) { return window.__contentTabDirtyState[k]; });
      window.__adminDirtyState[section] = anyDirty;
    } else {
      window.__adminDirtyState[section] = false;
    }
    if (saveTimers[section]) clearTimeout(saveTimers[section]);
    if (window.updateUnsavedUI) window.updateUnsavedUI();
    if (window.updateSectionSaveButtons) window.updateSectionSaveButtons(section);
  }

  function handleOnline() {
    isOnline = true;
    setStatus('saved', 'Conexión restaurada - Sincronizando...');
    processQueue();
  }

  function handleOffline() {
    isOnline = false;
    setStatus('offline', 'Sin conexión - Los cambios se guardarán al reconectar');
  }

  function initAutosave() {
    initStatusElements();

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    var saveAllBtn = document.getElementById('saveAllBtn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', saveAllSections);
    }

    if (typeof window.markDirty === 'function') {
      var originalMarkDirty = window.markDirty;
      window.markDirty = function (section, subSection) {
        originalMarkDirty(section, subSection);
        markDirty(section, subSection);
      };
    } else {
      window.markDirty = markDirty;
    }

    if (typeof window.clearDirty === 'function') {
      var originalClearDirty = window.clearDirty;
      window.clearDirty = function (section, subSection) {
        originalClearDirty(section, subSection);
        clearDirty(section, subSection);
      };
    } else {
      window.clearDirty = clearDirty;
    }

    window.registerSaveFunction = registerSaveFunction;
    window.saveAllSections = saveAllSections;
    window.getAutosaveStatus = function () { return saveQueue.length > 0 ? 'pending' : 'idle'; };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutosave);
  } else {
    initAutosave();
  }

})();