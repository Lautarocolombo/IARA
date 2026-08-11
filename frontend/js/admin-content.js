/* ==================== ADMIN CONTENT EDITOR.JS ==================== */
/* Editor de textos del sitio: site_texts (key-value) + site_settings (contacto) */

(function () {
  'use strict';

  var DEFAULT_TEXTS = {
    hero_title: 'Regalos <em>artesanales</em> que cuentan historias',
    hero_subtitle: 'Pulseras, souvenirs y llaveros hechos a mano. Cada pieza es única.',
    hero_cta_text: 'Explorar Catálogo',
    hero_cta_url: '#catalog',
    about_text: 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.',
    process_subtitle: 'Cinco pasos simples para comprar tu artesanía',
    process_step_1_title: '1) Elegí productos',
    process_step_1_desc: 'Filtrá por categoría y elegí tu pieza del catálogo.',
    process_step_2_title: '2) Sumá al carrito',
    process_step_2_desc: 'Presioná "Agregar" para guardar tu selección.',
    process_step_3_title: '3) Revisá el carrito',
    process_step_3_desc: 'Verificá cantidad, subtotal y total antes de pagar.',
    process_step_4_title: '4) Transferencia bancaria',
    process_step_4_desc: 'Recibí el comprobante por WhatsApp y confirmá tu pedido.',
    process_step_5_title: '5) Confirmación',
    process_step_5_desc: 'Al finalizar, vas a ver el comprobante en pantalla.',
    feature_1_title: 'Hecho a mano',
    feature_1_desc: 'Cada pieza es artesanal y única',
    feature_2_title: 'Envío gratis',
    feature_2_desc: 'En compras mayores a ARS 2.000',
    feature_3_title: 'Materiales premium',
    feature_3_desc: 'Seleccionados con cuidado',
    feature_4_title: 'Para regalar',
    feature_4_desc: 'Empaques especiales disponibles',
    stat_clients: '500',
    stat_products_sold: '1000',
    stat_years: '5',
    stat_artesanal: '100',
    horario: 'Lunes a domingo: 9:00 a 20:00'
  };

  var DEFAULT_SETTINGS = {
    email: 'chicafittargentina@gmail.com',
    phone: '+54 (3444) 634-4444',
    whatsapp: '+5493444634444',
    address: 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina',
    instagram: '',
    facebook: '',
    business_name: 'Artesanía Gualeguay'
  };

  var textsCache = {};
  var settingsCache = {};

  async function loadAllContent() {
    try {
      var res = await window.adminFetch('/api/site-texts', { method: 'GET' });
      if (res && res.ok) {
        textsCache = await res.json();
      } else {
        textsCache = {};
      }
    } catch (err) {
      console.error('[Content] Error cargando site-texts:', err);
      textsCache = {};
    }

    try {
      var res2 = await window.adminFetch('/api/admin/settings', { method: 'GET' });
      if (res2 && res2.ok) {
        settingsCache = await res2.json();
      } else {
        settingsCache = {};
      }
    } catch (err) {
      console.error('[Content] Error cargando site-settings:', err);
      settingsCache = {};
    }

    renderProcessSteps();
    populateFields();
  }

  function renderProcessSteps() {
    var container = document.getElementById('processSteps');
    if (!container) return;

    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<div class="process-step-card">' +
        '<div class="form-group">' +
          '<label>Paso ' + i + ' — Título</label>' +
          '<input type="text" id="process_step_' + i + '_title" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Paso ' + i + ' — Descripción</label>' +
          '<textarea id="process_step_' + i + '_desc" rows="2"></textarea>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  function populateFields() {
    for (var key in DEFAULT_TEXTS) {
      var el = document.getElementById(key);
      if (!el) continue;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      if (el.tagName === 'TEXTAREA') {
        el.value = val || '';
      } else {
        el.value = val || '';
      }
    }

    var settingMap = {
      contact_email: 'email',
      contact_phone: 'phone',
      contact_whatsapp: 'whatsapp',
      contact_address: 'address',
      contact_instagram: 'instagram',
      contact_facebook: 'facebook'
    };
    for (var elemId in settingMap) {
      var el = document.getElementById(elemId);
      if (!el) continue;
      var settingKey = settingMap[elemId];
      var val = settingsCache[settingKey] !== undefined ? settingsCache[settingKey] : (DEFAULT_SETTINGS[settingKey] || '');
      el.value = val || '';
    }
  }

  function setButtonState(btnId, loadingId, loading, text, loadingText) {
    var btn = document.getElementById(btnId);
    var loadingSpan = document.getElementById(loadingId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.classList.add('is-saving');
    } else {
      btn.classList.remove('is-saving');
    }
    var textSpan = loadingSpan ? loadingSpan.previousElementSibling : null;
    if (textSpan && textSpan.id === btnId + 'Text') {
      textSpan.textContent = loading ? loadingText : text;
    }
    if (loadingSpan) loadingSpan.classList.toggle('hidden', !loading);
  }

  function showSaveStatus(statusId, type, message) {
    var el = document.getElementById(statusId);
    if (!el) return;
    el.className = 'save-status visible ' + type;
    el.textContent = message;
    setTimeout(function () {
      if (el) { el.className = 'save-status'; el.textContent = ''; }
    }, 4000);
  }

  function collectTextKeys(prefix) {
    switch (prefix) {
      case 'hero':
        return ['hero_title', 'hero_subtitle', 'hero_cta_text', 'hero_cta_url'];
      case 'about':
        return ['about_text'];
      case 'features':
        return ['feature_1_title', 'feature_1_desc', 'feature_2_title', 'feature_2_desc',
                'feature_3_title', 'feature_3_desc', 'feature_4_title', 'feature_4_desc'];
      case 'process':
        var keys = ['process_subtitle'];
        for (var i = 1; i <= 5; i++) {
          keys.push('process_step_' + i + '_title', 'process_step_' + i + '_desc');
        }
        return keys;
      case 'stats':
        return ['stat_clients', 'stat_products_sold', 'stat_years', 'stat_artesanal'];
      case 'contact-texts':
        return ['horario'];
      default:
        return [];
    }
  }

  async function saveTexts(scope) {
    var btnId = 'save' + scope.charAt(0).toUpperCase() + scope.slice(1) + 'Btn';
    var loadingId = btnId + 'Loading';
    var statusId = 'save' + scope.charAt(0).toUpperCase() + scope.slice(1) + 'Status';

    var keys = collectTextKeys(scope);
    if (!keys.length) return;

    setButtonState(btnId, loadingId, true, 'Guardar cambios', 'Guardando...');
    showSaveStatus(statusId, 'saving', 'Guardando cambios...');

    var payload = {};
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById(keys[i]);
      payload[keys[i]] = el ? el.value.trim() : '';
    }

    try {
      var res = await window.adminFetch('/api/admin/sync-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res || !res.ok) {
        var errMsg = 'Error al guardar. Intentá de nuevo.';
        if (res) {
          var errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      var data = await res.json();
      textsCache = Object.assign({}, textsCache, payload);

      showSaveStatus(statusId, 'success', 'Cambios guardados correctamente (' + (data.results?.saved || keys.length) + ' campos)');
      window.showToast('✅', 'Cambios guardados correctamente', 'success');
    } catch (err) {
      console.error('[Content] Error guardando textos:', err);
      showSaveStatus(statusId, 'error', err.message || 'Error guardando cambios');
      window.showToast('❌', err.message || 'Error al guardar los cambios', 'error');
    } finally {
      setButtonState(btnId, loadingId, false, 'Guardar cambios', 'Guardando...');
    }
  }

  async function saveContactSettings() {
    var btnId = 'saveContactBtn';
    var loadingId = 'saveContactBtnLoading';
    var statusId = 'saveContactStatus';

    setButtonState(btnId, loadingId, true, 'Guardar cambios', 'Guardando...');
    showSaveStatus(statusId, 'saving', 'Guardando cambios...');

    var payload = {
      email: document.getElementById('contact_email')?.value.trim() || '',
      phone: document.getElementById('contact_phone')?.value.trim() || '',
      whatsapp: document.getElementById('contact_whatsapp')?.value.trim() || '',
      address: document.getElementById('contact_address')?.value.trim() || '',
      instagram: document.getElementById('contact_instagram')?.value.trim() || '',
      facebook: document.getElementById('contact_facebook')?.value.trim() || ''
    };

    var horario = document.getElementById('contact_horario')?.value.trim() || '';
    var textPayload = { horario: horario };

    try {
      var res = await window.adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res || !res.ok) {
        var errMsg = 'Error al guardar configuración.';
        if (res) {
          var errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      settingsCache = Object.assign({}, settingsCache, payload);

      if (horario) {
        var res2 = await window.adminFetch('/api/admin/sync-texts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(textPayload)
        });
        if (res2 && res2.ok) {
          textsCache.horario = horario;
        }
      }

      showSaveStatus(statusId, 'success', 'Cambios guardados correctamente');
      window.showToast('✅', 'Datos de contacto guardados correctamente', 'success');
    } catch (err) {
      console.error('[Content] Error guardando settings:', err);
      showSaveStatus(statusId, 'error', err.message || 'Error guardando cambios');
      window.showToast('❌', err.message || 'Error al guardar los cambios', 'error');
    } finally {
      setButtonState(btnId, loadingId, false, 'Guardar cambios', 'Guardando...');
    }
  }

  function initContentEditor() {
    loadAllContent();

    var saveButtons = [
      { id: 'saveHeroBtn', scope: 'hero' },
      { id: 'saveAboutBtn', scope: 'about' },
      { id: 'saveFeaturesBtn', scope: 'features' },
      { id: 'saveProcessBtn', scope: 'process' },
      { id: 'saveStatsBtn', scope: 'stats' }
    ];

    saveButtons.forEach(function (btn) {
      var el = document.getElementById(btn.id);
      if (el) {
        el.addEventListener('click', function () { saveTexts(btn.scope); });
      }
    });

    var contactBtn = document.getElementById('saveContactBtn');
    if (contactBtn) {
      contactBtn.addEventListener('click', saveContactSettings);
    }
  }

  window.initContentEditor = initContentEditor;
  window.reloadContent = loadAllContent;
})();
