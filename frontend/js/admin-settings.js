(function () {
  'use strict';

  var settings = {};
  var payment = {};

  function setField(id, value) {
    var field = document.getElementById(id);
    if (!field) return;
    if (field.type === 'checkbox') field.checked = value !== false;
    else field.value = value === null || value === undefined ? '' : value;
  }

  function field(id) {
    var element = document.getElementById(id);
    if (!element) return '';
    return element.type === 'checkbox' ? element.checked : element.value;
  }

  function safeToast(icon, message, type) {
    if (typeof window.showToast === 'function') { window.showToast(icon, message, type); return; }
    if (type === 'error') console.error('[admin-settings]', message);
    else console.log('[admin-settings]', message);
  }

  function showLoadingSafe(el, label) {
    if (typeof window.showLoading === 'function' && el) window.showLoading(el, { label: label });
  }

  function hideLoadingSafe(el) {
    if (typeof window.hideLoading === 'function' && el) window.hideLoading(el);
    else if (el) el.innerHTML = '';
  }

  function status(elementId, type, message) {
    var element = document.getElementById(elementId);
    if (!element) return;
    element.className = 'save-status ' + type;
    element.textContent = message;
  }

  function loadSettings() {
    var loading = document.getElementById('businessSaveStatus');
    showLoadingSafe(loading, 'Cargando configuración...');
    Promise.all([
      window.adminFetch('/api/v1/admin/settings'),
      window.adminFetch('/api/v1/admin/payment-config')
    ]).then(function (responses) {
      settings = responses[0] || {};
      payment = responses[1] || {};

      setField('businessName', settings.businessName);
      setField('businessLogo', settings.businessLogo);
      setField('businessEmail', settings.businessEmail);
      setField('businessPhone', settings.businessPhone);
      setField('businessWhatsapp', settings.businessWhatsapp);
      setField('businessAddress', settings.businessAddress);
      setField('socialInstagram', settings.socialInstagram);
      setField('socialFacebook', settings.socialFacebook);
      setField('socialTwitter', settings.socialTwitter);
      setField('shippingZones', settings.shippingZones);

      setField('mpAlias', payment.mpAlias);
      setField('transferAlias', payment.transferAlias);
      setField('holderName', payment.holderName);
      setField('cbuCvu', payment.cbuCvu);
      setField('paymentMessage', payment.paymentMessage);
      setField('shippingCost', payment.shippingCost);
      setField('freeShippingFrom', payment.freeShippingFrom);
      setField('includedShippingCost', payment.includedShippingCost);
      setField('paymentActive', payment.paymentActive);
      setField('mpEnabled', payment.mpEnabled);
      setField('cashEnabled', payment.cashEnabled);
      setField('notifyAdminNewProof', payment.notifyAdminNewProof);
      setField('notifyClientApproved', payment.notifyClientApproved);
      setField('notifyClientRejected', payment.notifyClientRejected);

      setField('googleAnalyticsId', settings.googleAnalyticsId);
      setField('facebookPixelId', settings.facebookPixelId);
      setField('sentryDsn', settings.sentryDsn);
      setField('googlePlaceId', settings.googlePlaceId);
      setField('googleReviewUrl', settings.googleReviewUrl);
      setField('googleMapsKey', settings.googleMapsKey);

      hideLoadingSafe(loading);
      status('businessSaveStatus', 'success', 'Configuración cargada.');
      setTimeout(function() { status('businessSaveStatus', '', ''); }, 2000);
    }).catch(function (err) {
      hideLoadingSafe(loading);
      status('businessSaveStatus', 'error', err.message || 'No se pudo cargar la configuración.');
      safeToast('!', err.message || 'Error al cargar configuración', 'error');
    });
  }

  function saveBusiness() {
    var sitePayload = {
      businessName: field('businessName'),
      businessLogo: field('businessLogo'),
      businessEmail: field('businessEmail'),
      businessPhone: field('businessPhone'),
      businessWhatsapp: field('businessWhatsapp'),
      businessAddress: field('businessAddress'),
      socialInstagram: field('socialInstagram'),
      socialFacebook: field('socialFacebook'),
      socialTwitter: field('socialTwitter'),
      shippingZones: field('shippingZones')
    };
    var btn = document.getElementById('saveBusinessBtn');
    var btnText = document.getElementById('saveBusinessBtnText');
    var btnLoading = document.getElementById('saveBusinessBtnLoading');
    if (btn) { btn.disabled = true; }
    if (btnText) { btnText.style.display = 'none'; }
    if (btnLoading) { btnLoading.style.display = 'inline'; }
    status('businessSaveStatus', '', 'Guardando...');

    window.adminFetch('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify(sitePayload) })
      .then(function () {
        settings = Object.assign({}, settings, sitePayload);
        status('businessSaveStatus', 'success', 'Datos del negocio guardados.');
        safeToast('✓', 'Datos del negocio guardados', 'success');
      })
      .catch(function (err) {
        status('businessSaveStatus', 'error', err.message || 'No se pudo guardar.');
        safeToast('!', err.message || 'Error al guardar', 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; }
        if (btnText) { btnText.style.display = 'inline'; }
        if (btnLoading) { btnLoading.style.display = 'none'; }
      });
  }

  function savePayment() {
    var paymentPayload = {
      mpAlias: field('mpAlias'),
      transferAlias: field('transferAlias'),
      holderName: field('holderName'),
      cbuCvu: field('cbuCvu'),
      paymentMessage: field('paymentMessage'),
      shippingCost: Number(field('shippingCost') || 0),
      freeShippingFrom: Number(field('freeShippingFrom') || 0),
      includedShippingCost: Number(field('includedShippingCost') || 0),
      paymentActive: field('paymentActive'),
      mpEnabled: field('mpEnabled'),
      cashEnabled: field('cashEnabled'),
      notifyAdminNewProof: field('notifyAdminNewProof'),
      notifyClientApproved: field('notifyClientApproved'),
      notifyClientRejected: field('notifyClientRejected')
    };
    var btn = document.getElementById('savePaymentBtn');
    var btnText = document.getElementById('savePaymentBtnText');
    var btnLoading = document.getElementById('savePaymentBtnLoading');
    if (btn) { btn.disabled = true; }
    if (btnText) { btnText.style.display = 'none'; }
    if (btnLoading) { btnLoading.style.display = 'inline'; }
    status('paymentSaveStatus', '', 'Guardando...');

    Promise.all([
      window.adminFetch('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify({ /* solo payment se guarda aquí */ }) }),
      window.adminFetch('/api/v1/admin/payment-config', { method: 'PUT', body: JSON.stringify(paymentPayload) })
    ]).then(function () {
      payment = Object.assign({}, payment, paymentPayload);
      status('paymentSaveStatus', 'success', 'Métodos de pago guardados.');
      safeToast('✓', 'Métodos de pago guardados', 'success');
    }).catch(function (err) {
      status('paymentSaveStatus', 'error', err.message || 'No se pudo guardar.');
      safeToast('!', err.message || 'Error al guardar', 'error');
    }).finally(function () {
      if (btn) { btn.disabled = false; }
      if (btnText) { btnText.style.display = 'inline'; }
      if (btnLoading) { btnLoading.style.display = 'none'; }
    });
  }

  function saveIntegrations() {
    var sitePayload = {
      googleAnalyticsId: field('googleAnalyticsId'),
      facebookPixelId: field('facebookPixelId'),
      sentryDsn: field('sentryDsn'),
      googlePlaceId: field('googlePlaceId'),
      googleReviewUrl: field('googleReviewUrl'),
      googleMapsKey: field('googleMapsKey')
    };
    var btn = document.getElementById('saveIntegrationsBtn');
    var btnText = document.getElementById('saveIntegrationsBtnText');
    var btnLoading = document.getElementById('saveIntegrationsBtnLoading');
    if (btn) { btn.disabled = true; }
    if (btnText) { btnText.style.display = 'none'; }
    if (btnLoading) { btnLoading.style.display = 'inline'; }
    status('integrationsSaveStatus', '', 'Guardando...');

    window.adminFetch('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify(sitePayload) })
      .then(function () {
        settings = Object.assign({}, settings, sitePayload);
        status('integrationsSaveStatus', 'success', 'Integraciones guardadas.');
        safeToast('✓', 'Integraciones guardadas', 'success');
      })
      .catch(function (err) {
        status('integrationsSaveStatus', 'error', err.message || 'No se pudo guardar.');
        safeToast('!', err.message || 'Error al guardar', 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; }
        if (btnText) { btnText.style.display = 'inline'; }
        if (btnLoading) { btnLoading.style.display = 'none'; }
      });
  }

  function init() {
    if (window.adminSidebar && typeof window.adminSidebar.init === 'function') {
      window.adminSidebar.init({
        onLogout: function () {
          if (typeof doLogout === 'function') doLogout();
        }
      });
    }

    var nav = document.getElementById('adminNav');
    if (nav) {
      nav.addEventListener('click', function (e) {
        if (!e.target.closest('a[data-section]')) return;
        if (window.adminSidebar && typeof window.adminSidebar.isDrawerOpen === 'function' && window.adminSidebar.isDrawerOpen()) {
          window.adminSidebar.closeDrawer(true);
        }
      });
    }

    var saveBusinessBtn = document.getElementById('saveBusinessBtn');
    var savePaymentBtn = document.getElementById('savePaymentBtn');
    var saveIntegrationsBtn = document.getElementById('saveIntegrationsBtn');
    if (saveBusinessBtn) saveBusinessBtn.addEventListener('click', saveBusiness);
    if (savePaymentBtn) savePaymentBtn.addEventListener('click', savePayment);
    if (saveIntegrationsBtn) saveIntegrationsBtn.addEventListener('click', saveIntegrations);

    loadSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());