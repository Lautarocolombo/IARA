/* ==================== ADMIN CONTENT EDITOR.JS ==================== */
/* Editor de textos del sitio: site_texts (key-value) + site_settings (contacto) */

(function () {
  'use strict';

  var DEFAULT_TEXTS = {
    hero_title: 'Regalos <em>artesanales</em> que cuentan historias',
    hero_subtitle: 'Pulseras, souvenirs y llaveros hechos a mano. Cada pieza es única.',
    hero_cta_text: 'Explorar Catálogo',
    hero_cta_url: '#catalog',
    hero_image_url: '',
    featured_product_name: 'Anillo Cerámica',
    featured_product_description: 'Artesanía con alma',
    featured_product_cta_text: 'Ver producto',
    featured_product_cta_url: '#catalog',
    featured_product_image_url: '',
    hero_card_1_text: 'Nose si estemos hechos el uno para el otro pero si hemos llegado hasta aquí...',
    hero_card_2_text: 'Nose si estemos hechos el uno para el otro pero si hemos llegado hasta aquí...',
    hero_card_1_name: 'Pulsera Minimalista',
    hero_card_1_price: '$450',
    hero_card_1_cta_text: 'Ver más',
    hero_card_1_cta_url: '#catalog',
    about_text: 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.',
    about_image_1: '',
    about_image_2: '',
    about_image_3: '',
    about_image_4: '',
    about_image_5: '',
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
    email: 'CONFIGURAR_EMAIL',
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
    await loadFeaturedCategories();
    if (window.refreshAllSaveButtons) window.refreshAllSaveButtons();
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

  var quillEditor = null;

  function initQuillEditor() {
    var container = document.getElementById('about_text_editor');
    if (!container || typeof Quill === 'undefined') return;
    quillEditor = new Quill(container, {
      theme: 'snow',
      placeholder: 'En cada pieza dejamos un pedacito de Gualeguay...',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link'],
          ['clean']
        ]
      }
    });
    quillEditor.on('text-change', function () {
      if (window.markDirty) window.markDirty('content');
    });
  }

  async function loadFeaturedCategories() {
    try {
      var res = await window.adminFetch('/api/admin/categories', { method: 'GET' });
      if (!res || !res.ok) return;
      var data = await res.json();
      var select = document.getElementById('featured_categories');
      if (!select) return;
      var html = '';
      data.forEach(function (c) {
        html += '<option value="' + c.id + '">' + (c.emoji ? c.emoji + ' ' : '') + escapeHtml(c.name) + '</option>';
      });
      select.innerHTML = html;

      var saved = textsCache['featured_categories'];
      if (saved) {
        var ids = [];
        try { ids = JSON.parse(saved); } catch (e) { ids = []; }
        if (Array.isArray(ids)) {
          var opts = select.querySelectorAll('option');
          opts.forEach(function (opt) {
            opt.selected = ids.indexOf(Number(opt.value)) !== -1;
          });
        }
      }
    } catch (err) {
      console.error('[Content] Error cargando categorías destacadas:', err);
    }
  }

  async function saveFeaturedCategories() {
    var btnId = 'saveFeaturedBtn';
    var loadingId = 'saveFeaturedBtnLoading';
    var statusId = 'saveFeaturedStatus';
    setButtonState(btnId, loadingId, true, 'Guardar cambios', 'Guardando...');
    showSaveStatus(statusId, 'saving', 'Guardando cambios...');

    var select = document.getElementById('featured_categories');
    var selected = [];
    if (select) {
      Array.from(select.selectedOptions).forEach(function (opt) {
        selected.push(Number(opt.value));
      });
    }

    try {
      var res = await window.adminFetch('/api/admin/sync-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured_categories: JSON.stringify(selected) })
      });
      if (!res || !res.ok) {
        let errMsg = 'Error al guardar.';
        if (res) {
          let errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }
      textsCache.featured_categories = JSON.stringify(selected);
      showSaveStatus(statusId, 'success', 'Categorías destacadas guardadas');
      window.showToast('✅', 'Categorías destacadas guardadas', 'success');
      if (window.clearDirty) window.clearDirty('content');
    } catch (err) {
      showSaveStatus(statusId, 'error', err.message || 'Error guardando cambios');
      window.showToast('❌', err.message || 'Error al guardar', 'error');
    } finally {
      setButtonState(btnId, loadingId, false, 'Guardar cambios', 'Guardando...');
    }
  }

  function populateFields() {
    var heroKeys = ['hero_title', 'hero_subtitle', 'hero_cta_text', 'hero_cta_url'];
    heroKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var fpKeys = ['featured_product_name', 'featured_product_description', 'featured_product_cta_text', 'featured_product_cta_url'];
    fpKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var heroCardTextKeys = ['hero_card_1_text', 'hero_card_2_text'];
    heroCardTextKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var heroCard1Keys = ['hero_card_1_name', 'hero_card_1_price', 'hero_card_1_cta_text', 'hero_card_1_cta_url'];
    heroCard1Keys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var heroImageUrl = textsCache['hero_image_url'] || '';
    var heroPreviewImg = document.getElementById('heroImagePreview');
    var heroPlaceholder = document.getElementById('heroImagePlaceholder');
    if (heroPreviewImg && heroPlaceholder) {
      if (heroImageUrl) {
        heroPreviewImg.src = heroImageUrl;
        heroPreviewImg.style.display = 'block';
        heroPlaceholder.style.display = 'none';
      } else {
        heroPreviewImg.style.display = 'none';
        heroPlaceholder.style.display = 'flex';
      }
    }

    var fpImageUrl = textsCache['featured_product_image_url'] || '';
    var fpPreviewImg = document.getElementById('fpImagePreview');
    var fpPlaceholder = document.getElementById('fpImagePlaceholder');
    if (fpPreviewImg && fpPlaceholder) {
      if (fpImageUrl) {
        fpPreviewImg.src = fpImageUrl;
        fpPreviewImg.style.display = 'block';
        fpPlaceholder.style.display = 'none';
      } else {
        fpPreviewImg.style.display = 'none';
        fpPlaceholder.style.display = 'flex';
      }
    }

    var aboutTextKeys = ['about_text'];
    aboutTextKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      if (key === 'about_text' && quillEditor) {
        quillEditor.root.innerHTML = val || '';
      } else if (el.tagName === 'TEXTAREA') {
        el.value = val || '';
      } else {
        el.value = val || '';
      }
    });

    for (let i = 1; i <= 5; i++) {
      (function(index) {
        var key = 'about_image_' + index;
        var url = textsCache[key] || '';
        var preview = document.getElementById('aboutImagePreview' + index);
        var placeholder = document.getElementById('aboutImagePlaceholder' + index);
        var removeBtn = document.getElementById('aboutImageRemoveBtn' + index);
        if (preview && placeholder) {
          if (url) {
            preview.src = url;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
          } else {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
          }
        }
        if (removeBtn) removeBtn.dataset.remove = 'false';
      })(i);
    }

    var featureKeys = ['feature_1_title', 'feature_1_desc', 'feature_2_title', 'feature_2_desc',
                    'feature_3_title', 'feature_3_desc', 'feature_4_title', 'feature_4_desc'];
    featureKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var processKeys = ['process_subtitle'];
    for (var i = 1; i <= 5; i++) {
      processKeys.push('process_step_' + i + '_title', 'process_step_' + i + '_desc');
    }
    processKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var statKeys = ['stat_clients', 'stat_products_sold', 'stat_years', 'stat_artesanal'];
    statKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      var val = textsCache[key] !== undefined ? textsCache[key] : DEFAULT_TEXTS[key];
      el.value = val || '';
    });

    var settingMap = {
      contact_email: 'email',
      contact_phone: 'phone',
      contact_whatsapp: 'whatsapp',
      contact_address: 'address',
      contact_instagram: 'instagram',
      contact_facebook: 'facebook'
    };
    for (var elemId in settingMap) {
      var settingEl = document.getElementById(elemId);
      if (!settingEl) continue;
      var settingKey = settingMap[elemId];
      var settingVal = settingsCache[settingKey] !== undefined ? settingsCache[settingKey] : (DEFAULT_SETTINGS[settingKey] || '');
      settingEl.value = settingVal || '';
    }

    var horarioEl = document.getElementById('horario');
    if (horarioEl) {
      var horarioVal = textsCache['horario'] !== undefined ? textsCache['horario'] : DEFAULT_TEXTS['horario'];
      horarioEl.value = horarioVal || '';
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
      textSpan.classList.toggle('hidden', loading);
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

  async function saveHomeBlocks() {
    var btnId = 'saveHomeBlocksBtn';
    var loadingId = 'saveHomeBlocksBtnLoading';
    var statusId = 'saveHomeBlocksStatus';

    var heroTitle = document.getElementById('hero_title')?.value.trim() || '';
    var heroSubtitle = document.getElementById('hero_subtitle')?.value.trim() || '';
    var heroCtaText = document.getElementById('hero_cta_text')?.value.trim() || '';
    var heroCtaUrl = document.getElementById('hero_cta_url')?.value.trim() || '';

    var fpName = document.getElementById('fp_name')?.value.trim() || '';
    var fpDesc = document.getElementById('fp_description')?.value.trim() || '';
    var fpCtaText = document.getElementById('fp_cta_text')?.value.trim() || '';
    var fpCtaUrl = document.getElementById('fp_cta_url')?.value.trim() || '';
    var heroCard1Text = document.getElementById('hero_card_1_text')?.value.trim() || '';
    var heroCard1Name = document.getElementById('hero_card_1_name')?.value.trim() || '';
    var heroCard1Price = document.getElementById('hero_card_1_price')?.value.trim() || '';
    var heroCard1CtaText = document.getElementById('hero_card_1_cta_text')?.value.trim() || '';
    var heroCard1CtaUrl = document.getElementById('hero_card_1_cta_url')?.value.trim() || '';
    var heroCard2Text = document.getElementById('hero_card_2_text')?.value.trim() || '';

    if (!heroTitle) {
      showSaveStatus(statusId, 'error', 'El título del Hero es obligatorio');
      window.showToast('❌', 'El título del Hero es obligatorio', 'error');
      return;
    }
    if (!fpName) {
      showSaveStatus(statusId, 'error', 'El nombre del producto es obligatorio');
      window.showToast('❌', 'El nombre del producto es obligatorio', 'error');
      return;
    }

    setButtonState(btnId, loadingId, true, 'Guardar en Nube', 'Guardando...');
    showSaveStatus(statusId, 'saving', 'Guardando cambios...');

    try {
      var heroImageFileInput = document.getElementById('heroImageInput');
      var heroImageFile = heroImageFileInput ? heroImageFileInput.files[0] : null;
      var heroImageRemoveBtn = document.getElementById('heroImageRemoveBtn');
      var heroRemoveFlag = heroImageRemoveBtn ? heroImageRemoveBtn.dataset.remove === 'true' : false;

      var fpImageFileInput = document.getElementById('fpImageInput');
      var fpImageFile = fpImageFileInput ? fpImageFileInput.files[0] : null;
      var fpImageRemoveBtn = document.getElementById('fpImageRemoveBtn');
      var fpRemoveFlag = fpImageRemoveBtn ? fpImageRemoveBtn.dataset.remove === 'true' : false;

      var heroImageUrl = textsCache['hero_image_url'] || '';
      var fpImageUrl = textsCache['featured_product_image_url'] || '';

      var uploadPromises = [];
      var uploadMap = {};
      var uploadErrors = {};

      if (heroImageFile) {
        var formDataHero = new FormData();
        formDataHero.append('image', heroImageFile);
        var heroPromise = window.adminFetch('/api/admin/upload', {
          method: 'POST',
          body: formDataHero
        }).then(async function (res) {
          if (!res || !res.ok) {
            let errMsg = 'Error al subir imagen del hero.';
            if (res) {
              let errData = await res.json().catch(function () { return {}; });
              errMsg = errData.error || errMsg;
            }
            throw new Error(errMsg);
          }
          var data = await res.json();
          heroImageUrl = data.url || '';
          uploadMap.hero = heroImageUrl;
        }).catch(function (err) {
          uploadErrors.hero = err.message || 'Error al subir imagen del hero';
          throw err;
        });
        uploadPromises.push(heroPromise);
      } else if (heroRemoveFlag) {
        heroImageUrl = '';
      }

      if (fpImageFile) {
        var formDataFp = new FormData();
        formDataFp.append('image', fpImageFile);
        var fpPromise = window.adminFetch('/api/admin/upload', {
          method: 'POST',
          body: formDataFp
        }).then(async function (res) {
          if (!res || !res.ok) {
            let errMsg = 'Error al subir imagen del producto.';
            if (res) {
              let errData = await res.json().catch(function () { return {}; });
              errMsg = errData.error || errMsg;
            }
            throw new Error(errMsg);
          }
          var data = await res.json();
          fpImageUrl = data.url || '';
          uploadMap.fp = fpImageUrl;
        }).catch(function (err) {
          uploadErrors.fp = err.message || 'Error al subir imagen del producto';
          throw err;
        });
        uploadPromises.push(fpPromise);
      } else       if (fpRemoveFlag) {
        fpImageUrl = '';
      }

      if (uploadPromises.length > 0) {
        try {
          await Promise.all(uploadPromises);
        } catch (err) {
          var heroImageErrorEl = document.getElementById('heroImageError');
          var fpImageErrorEl = document.getElementById('fpImageError');
          if (heroImageErrorEl && uploadErrors.hero) {
            heroImageErrorEl.textContent = uploadErrors.hero;
            heroImageErrorEl.style.display = 'block';
          }
          if (fpImageErrorEl && uploadErrors.fp) {
            fpImageErrorEl.textContent = uploadErrors.fp;
            fpImageErrorEl.style.display = 'block';
          }
          throw new Error(uploadErrors.hero || uploadErrors.fp || 'Error al subir imágenes');
        }
      }

      var payload = {
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        hero_cta_text: heroCtaText,
        hero_cta_url: heroCtaUrl,
        hero_image_url: heroImageUrl,
        featured_product_name: fpName,
        featured_product_description: fpDesc,
        featured_product_cta_text: fpCtaText,
        featured_product_cta_url: fpCtaUrl,
        featured_product_image_url: fpImageUrl,
        hero_card_1_text: heroCard1Text,
        hero_card_1_name: heroCard1Name,
        hero_card_1_price: heroCard1Price,
        hero_card_1_cta_text: heroCard1CtaText,
        hero_card_1_cta_url: heroCard1CtaUrl,
        hero_card_2_text: heroCard2Text
      };

      var res = await window.adminFetch('/api/admin/sync-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res || !res.ok) {
        let errMsg = 'Error al guardar. Intentá de nuevo.';
        if (res) {
          let errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      var data = await res.json();
      textsCache = Object.assign({}, textsCache, payload);

      if (heroImageFileInput) heroImageFileInput.value = '';
      if (heroImageRemoveBtn) delete heroImageRemoveBtn.dataset.remove;
      var heroImgErrorEl = document.getElementById('heroImageError');
      if (heroImgErrorEl) {
        heroImgErrorEl.style.display = 'none';
        heroImgErrorEl.textContent = '';
      }
      var heroNewPreview = document.getElementById('heroImageNewPreview');
      var heroNewImg = document.getElementById('heroImageNewImg');
      if (heroNewPreview) heroNewPreview.style.display = 'none';
      if (heroNewImg) heroNewImg.src = '';
      var heroImgPreview = document.getElementById('heroImagePreview');
      var heroPlaceholder = document.getElementById('heroImagePlaceholder');
      if (heroImgPreview && heroPlaceholder && payload['hero_image_url']) {
        heroImgPreview.src = payload['hero_image_url'];
        heroImgPreview.style.display = 'block';
        heroPlaceholder.style.display = 'none';
      } else if (heroImgPreview && heroPlaceholder) {
        heroImgPreview.style.display = 'none';
        heroPlaceholder.style.display = 'flex';
      }

      if (fpImageFileInput) fpImageFileInput.value = '';
      if (fpImageRemoveBtn) delete fpImageRemoveBtn.dataset.remove;
      var fpImgErrorEl = document.getElementById('fpImageError');
      if (fpImgErrorEl) {
        fpImgErrorEl.style.display = 'none';
        fpImgErrorEl.textContent = '';
      }
      var fpNewPreview = document.getElementById('fpImageNewPreview');
      var fpNewImg = document.getElementById('fpImageNewImg');
      if (fpNewPreview) fpNewPreview.style.display = 'none';
      if (fpNewImg) fpNewImg.src = '';
      var fpImgPreview = document.getElementById('fpImagePreview');
      var fpPlaceholder = document.getElementById('fpImagePlaceholder');
      if (fpImgPreview && fpPlaceholder && payload['featured_product_image_url']) {
        fpImgPreview.src = payload['featured_product_image_url'];
        fpImgPreview.style.display = 'block';
        fpPlaceholder.style.display = 'none';
      } else if (fpImgPreview && fpPlaceholder) {
        fpImgPreview.style.display = 'none';
        fpPlaceholder.style.display = 'flex';
      }

      showSaveStatus(statusId, 'success', 'Cambios guardados correctamente (' + (data.results?.saved || Object.keys(payload).length) + ' campos)');
      window.showToast('✅', 'Cambios guardados correctamente', 'success');
      if (window.clearDirty) window.clearDirty('content');
    } catch (err) {
      console.error('[Content] Error guardando bloques del home:', err);
      showSaveStatus(statusId, 'error', err.message || 'Error guardando cambios');
      window.showToast('❌', err.message || 'Error al guardar los cambios', 'error');
    } finally {
      setButtonState(btnId, loadingId, false, 'Guardar en Nube', 'Guardando...');
    }
  }

  function collectTextKeys(prefix) {
    switch (prefix) {
      case 'hero':
        return ['hero_title', 'hero_subtitle', 'hero_cta_text', 'hero_cta_url', 'hero_image_url'];
      case 'about':
        return ['about_text', 'about_image_1', 'about_image_2', 'about_image_3', 'about_image_4', 'about_image_5'];
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
        return ['contact_horario'];
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

    if (scope === 'about') {
      if (quillEditor) {
        var raw = quillEditor.root.innerHTML;
        var clean = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(raw) : raw;
        if (!clean || /^<p>\s*(<br\s*\/?>)?\s*<\/p>$/.test(clean) || /^<div>\s*(<br\s*\/?>)?\s*<\/div>$/.test(clean)) {
          payload['about_text'] = '';
        } else {
          payload['about_text'] = clean;
        }
      }

      var aboutImageUrls = {};
      var aboutUploadPromises = [];
      var aboutUploadErrors = {};

      for (let i = 1; i <= 5; i++) {
        (function(index) {
          var input = document.getElementById('aboutImageInput' + index);
          var removeBtn = document.getElementById('aboutImageRemoveBtn' + index);
          var removeFlag = removeBtn ? removeBtn.dataset.remove === 'true' : false;
          var currentUrl = textsCache['about_image_' + index] || '';

          if (input && input.files && input.files[0]) {
            var formData = new FormData();
            formData.append('image', input.files[0]);
            var promise = window.adminFetch('/api/admin/upload', {
              method: 'POST',
              body: formData
            }).then(async function (res) {
              if (!res || !res.ok) {
                let errMsg = 'Error al subir imagen ' + index + ' del carrusel.';
                if (res) {
                  let errData = await res.json().catch(function () { return {}; });
                  errMsg = errData.error || errMsg;
                }
                throw new Error(errMsg);
              }
              var data = await res.json();
              aboutImageUrls[index] = data.url || '';
            }).catch(function (err) {
              aboutUploadErrors[index] = err.message || 'Error al subir imagen ' + index;
              throw err;
            });
            aboutUploadPromises.push(promise);
          } else if (removeFlag) {
            aboutImageUrls[index] = '';
          } else {
            aboutImageUrls[index] = currentUrl;
          }
        })(i);
      }

      if (aboutUploadPromises.length > 0) {
        try {
          await Promise.all(aboutUploadPromises);
        } catch (err) {
          for (var j = 1; j <= 5; j++) {
            var errEl = document.getElementById('aboutImageError' + j);
            if (errEl && aboutUploadErrors[j]) {
              errEl.textContent = aboutUploadErrors[j];
              errEl.style.display = 'block';
            }
          }
          throw new Error(aboutUploadErrors[1] || 'Error al subir imágenes del carrusel');
        }
      }

      for (var a = 1; a <= 5; a++) {
        payload['about_image_' + a] = aboutImageUrls[a] || '';
      }
    } else {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key === 'about_text' && quillEditor) {
          var aboutRaw = quillEditor.root.innerHTML;
          var aboutClean = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(aboutRaw) : aboutRaw;
          payload[key] = aboutClean;
        } else if (key === 'hero_image_url') {
          continue;
        } else {
          var el = document.getElementById(key);
          payload[key] = el ? el.value.trim() : '';
        }
      }
    }

    try {
      var res = await window.adminFetch('/api/admin/sync-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res || !res.ok) {
        let errMsg = 'Error al guardar. Intentá de nuevo.';
        if (res) {
          let errData = await res.json().catch(function () { return {}; });
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      var data = await res.json();
      textsCache = Object.assign({}, textsCache, payload);

      if (scope === 'about') {
        for (let a = 1; a <= 5; a++) {
          (function(index) {
            var input = document.getElementById('aboutImageInput' + index);
            var removeBtn = document.getElementById('aboutImageRemoveBtn' + index);
            var errorEl = document.getElementById('aboutImageError' + index);
            var newPreview = document.getElementById('aboutImageNewPreview' + index);
            var newImg = document.getElementById('aboutImageNewImg' + index);
            var preview = document.getElementById('aboutImagePreview' + index);
            var placeholder = document.getElementById('aboutImagePlaceholder' + index);
            var url = payload['about_image_' + index] || '';

            if (input) input.value = '';
            if (removeBtn) delete removeBtn.dataset.remove;
            if (errorEl) {
              errorEl.style.display = 'none';
              errorEl.textContent = '';
            }
            if (newPreview) newPreview.style.display = 'none';
            if (newImg) newImg.src = '';
            if (preview && placeholder) {
              if (url) {
                preview.src = url;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
              } else {
                preview.style.display = 'none';
                placeholder.style.display = 'flex';
              }
            }
          })(a);
        }
      }

      showSaveStatus(statusId, 'success', 'Cambios guardados correctamente (' + (data.results?.saved || Object.keys(payload).length) + ' campos)');
      window.showToast('✅', 'Cambios guardados correctamente', 'success');
      if (window.clearDirty) window.clearDirty('content');
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

    var horario = document.getElementById('horario')?.value.trim() || '';
    var textPayload = { horario: horario };

    try {
      var res = await window.adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res || !res.ok) {
        let errMsg = 'Error al guardar configuración.';
        if (res) {
          let errData = await res.json().catch(function () { return {}; });
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
      if (window.clearDirty) window.clearDirty('content');
    } catch (err) {
      console.error('[Content] Error guardando settings:', err);
      showSaveStatus(statusId, 'error', err.message || 'Error guardando cambios');
      window.showToast('❌', err.message || 'Error al guardar los cambios', 'error');
    } finally {
      setButtonState(btnId, loadingId, false, 'Guardar cambios', 'Guardando...');
    }
  }

  function initContentEditor() {
    try {
      initQuillEditor();
      loadAllContent();

    var saveButtons = [
      { id: 'saveHomeBlocksBtn', scope: 'home-blocks' },
      { id: 'saveAboutBtn', scope: 'about' },
      { id: 'saveFeaturesBtn', scope: 'features' },
      { id: 'saveProcessBtn', scope: 'process' },
      { id: 'saveStatsBtn', scope: 'stats' }
    ];

    saveButtons.forEach(function (btn) {
      var el = document.getElementById(btn.id);
      if (el) {
        el.addEventListener('click', function () {
          if (btn.scope === 'home-blocks') {
            saveHomeBlocks();
          } else {
            saveTexts(btn.scope);
          }
        });
      }
    });

    var contactBtn = document.getElementById('saveContactBtn');
    if (contactBtn) {
      contactBtn.addEventListener('click', saveContactSettings);
    }

    var featuredBtn = document.getElementById('saveFeaturedBtn');
    if (featuredBtn) {
      featuredBtn.addEventListener('click', saveFeaturedCategories);
    }

    var featuredSelect = document.getElementById('featured_categories');
    if (featuredSelect) {
      featuredSelect.addEventListener('change', function () {
        if (window.markDirty) window.markDirty('content');
      });
    }

    var contactInputs = document.querySelectorAll('#contact_email, #contact_phone, #contact_whatsapp, #contact_address, #contact_instagram, #contact_facebook, #horario');
    contactInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        if (window.markDirty) window.markDirty('content');
      });
      input.addEventListener('change', function () {
        if (window.markDirty) window.markDirty('content');
      });
    });

    var heroInputs = document.querySelectorAll('#hero_title, #hero_subtitle, #hero_cta_text, #hero_cta_url');
    heroInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        if (window.markDirty) window.markDirty('content');
      });
      input.addEventListener('change', function () {
        if (window.markDirty) window.markDirty('content');
      });
    });

    var fpInputs = document.querySelectorAll('#fp_name, #fp_description, #fp_cta_text, #fp_cta_url, #hero_card_1_text, #hero_card_2_text');
    fpInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        if (window.markDirty) window.markDirty('content');
      });
      input.addEventListener('change', function () {
        if (window.markDirty) window.markDirty('content');
      });
    });

    var heroImageChangeBtn = document.getElementById('heroImageChangeBtn');
    var heroImageInput = document.getElementById('heroImageInput');
    var heroImageError = document.getElementById('heroImageError');
    if (heroImageChangeBtn && heroImageInput) {
      heroImageChangeBtn.addEventListener('click', function () {
        heroImageInput.click();
      });
      heroImageInput.addEventListener('change', function () {
        if (heroImageError) {
          heroImageError.style.display = 'none';
          heroImageError.textContent = '';
        }
        if (heroImageInput.files && heroImageInput.files[0]) {
          var file = heroImageInput.files[0];
          if (file.size > 5 * 1024 * 1024) {
            var heroMsg = 'La imagen es muy grande (máximo 5MB)';
            window.showToast('❌', heroMsg, 'error');
            if (heroImageError) {
              heroImageError.textContent = heroMsg;
              heroImageError.style.display = 'block';
            }
            heroImageInput.value = '';
            return;
          }
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            var heroMsg2 = 'Formato no soportado. Usá JPG, PNG o WEBP.';
            window.showToast('❌', heroMsg2, 'error');
            if (heroImageError) {
              heroImageError.textContent = heroMsg2;
              heroImageError.style.display = 'block';
            }
            heroImageInput.value = '';
            return;
          }
          var reader = new FileReader();
          reader.onload = function (e) {
            var newPreview = document.getElementById('heroImageNewPreview');
            var newImg = document.getElementById('heroImageNewImg');
            if (newPreview && newImg) {
              newImg.src = e.target.result;
              newPreview.style.display = 'block';
            }
            if (window.markDirty) window.markDirty('content');
          };
          reader.readAsDataURL(heroImageInput.files[0]);
        }
      });
    }

    var heroImageRemoveBtn = document.getElementById('heroImageRemoveBtn');
    if (heroImageRemoveBtn) {
      heroImageRemoveBtn.addEventListener('click', function () {
        heroImageRemoveBtn.dataset.remove = 'true';
        var heroImageInput = document.getElementById('heroImageInput');
        if (heroImageInput) heroImageInput.value = '';
        var newPreview = document.getElementById('heroImageNewPreview');
        var newImg = document.getElementById('heroImageNewImg');
        if (newPreview) newPreview.style.display = 'none';
        if (newImg) newImg.src = '';
        if (window.markDirty) window.markDirty('content');
      });
    }

    var fpImageChangeBtn = document.getElementById('fpImageChangeBtn');
    var fpImageInput = document.getElementById('fpImageInput');
    var fpImageError = document.getElementById('fpImageError');
    if (fpImageChangeBtn && fpImageInput) {
      fpImageChangeBtn.addEventListener('click', function () {
        fpImageInput.click();
      });
      fpImageInput.addEventListener('change', function () {
        if (fpImageError) {
          fpImageError.style.display = 'none';
          fpImageError.textContent = '';
        }
        if (fpImageInput.files && fpImageInput.files[0]) {
          var file = fpImageInput.files[0];
          if (file.size > 5 * 1024 * 1024) {
            var fpMsg = 'La imagen es muy grande (máximo 5MB)';
            window.showToast('❌', fpMsg, 'error');
            if (fpImageError) {
              fpImageError.textContent = fpMsg;
              fpImageError.style.display = 'block';
            }
            fpImageInput.value = '';
            return;
          }
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            var fpMsg2 = 'Formato no soportado. Usá JPG, PNG o WEBP.';
            window.showToast('❌', fpMsg2, 'error');
            if (fpImageError) {
              fpImageError.textContent = fpMsg2;
              fpImageError.style.display = 'block';
            }
            fpImageInput.value = '';
            return;
          }
          var reader = new FileReader();
          reader.onload = function (e) {
            var newPreview = document.getElementById('fpImageNewPreview');
            var newImg = document.getElementById('fpImageNewImg');
            if (newPreview && newImg) {
              newImg.src = e.target.result;
              newPreview.style.display = 'block';
            }
            if (window.markDirty) window.markDirty('content');
          };
          reader.readAsDataURL(fpImageInput.files[0]);
        }
      });
    }

    var fpImageRemoveBtn = document.getElementById('fpImageRemoveBtn');
    if (fpImageRemoveBtn) {
      fpImageRemoveBtn.addEventListener('click', function () {
        fpImageRemoveBtn.dataset.remove = 'true';
        var fpImageInput = document.getElementById('fpImageInput');
        if (fpImageInput) fpImageInput.value = '';
        var newPreview = document.getElementById('fpImageNewPreview');
        var newImg = document.getElementById('fpImageNewImg');
        if (newPreview) newPreview.style.display = 'none';
        if (newImg) newImg.src = '';
        if (window.markDirty) window.markDirty('content');
      });
    }

    for (var i = 1; i <= 5; i++) {
      (function(index) {
        var changeBtn = document.getElementById('aboutImageChangeBtn' + index);
        var input = document.getElementById('aboutImageInput' + index);
        var errorEl = document.getElementById('aboutImageError' + index);
        var removeBtn = document.getElementById('aboutImageRemoveBtn' + index);
        var newPreview = document.getElementById('aboutImageNewPreview' + index);
        var newImg = document.getElementById('aboutImageNewImg' + index);
        var preview = document.getElementById('aboutImagePreview' + index);
        var placeholder = document.getElementById('aboutImagePlaceholder' + index);

        if (changeBtn && input) {
          changeBtn.addEventListener('click', function () {
            input.click();
          });
          input.addEventListener('change', function () {
            if (errorEl) {
              errorEl.style.display = 'none';
              errorEl.textContent = '';
            }
            if (input.files && input.files[0]) {
              var file = input.files[0];
              if (file.size > 5 * 1024 * 1024) {
                var msg = 'La imagen es muy grande (máximo 5MB)';
                window.showToast('❌', msg, 'error');
                if (errorEl) {
                  errorEl.textContent = msg;
                  errorEl.style.display = 'block';
                }
                input.value = '';
                return;
              }
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                var msg2 = 'Formato no soportado. Usá JPG, PNG o WEBP.';
                window.showToast('❌', msg2, 'error');
                if (errorEl) {
                  errorEl.textContent = msg2;
                  errorEl.style.display = 'block';
                }
                input.value = '';
                return;
              }
               var reader = new FileReader();
               reader.onload = function (e) {
                 if (newPreview && newImg) {
                   newImg.src = e.target.result;
                   newPreview.style.display = 'block';
                 }
                 if (preview && placeholder) {
                   preview.src = e.target.result;
                   preview.style.display = 'block';
                   placeholder.style.display = 'none';
                 }
                 if (window.markDirty) window.markDirty('content');
               };
               reader.readAsDataURL(input.files[0]);
            }
          });
        }

        if (removeBtn) {
          removeBtn.addEventListener('click', function () {
            removeBtn.dataset.remove = 'true';
            if (input) input.value = '';
            if (newPreview) newPreview.style.display = 'none';
            if (newImg) newImg.src = '';
            if (window.markDirty) window.markDirty('content');
          });
        }
      })(i);
    }
  } catch (err) {
    console.error('[Content] Error inicializando editor:', err);
  }
  }

  async function saveAllContentSections() {
    var scopes = ['home-blocks', 'about', 'features', 'process', 'stats', 'contact-texts'];
    for (var i = 0; i < scopes.length; i++) {
      var scope = scopes[i];
      if (scope === 'contact-texts') {
        await saveContactSettings();
      } else if (scope === 'home-blocks') {
        await saveHomeBlocks();
      } else {
        await saveTexts(scope);
      }
    }
  }

  window.initContentEditor = initContentEditor;
  window.reloadContent = loadAllContent;
  window.saveAllContentSections = saveAllContentSections;
  window.discardAllContentChanges = loadAllContent;
})();