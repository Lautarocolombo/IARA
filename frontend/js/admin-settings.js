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
    // eslint-disable-next-line no-console
    if (type === 'error') console.error('[admin-settings]', message);
    // eslint-disable-next-line no-console
    else console.log('[admin-settings]', message);
  }

  function showLoadingSafe(el, label) {
    if (typeof window.showLoading === 'function' && el) window.showLoading(el, { label: label });
  }

  function hideLoadingSafe(el) {
    if (typeof window.hideLoading === 'function' && el) window.hideLoading(el);
    else if (el) el.innerHTML = '';
  }

  function status(type, message) {
    var element = document.getElementById('settingsSaveStatus');
    if (!element) return;
    element.className = 'admin-save-status ' + type;
    element.textContent = message;
  }

  function loadSettings() {
    var loading = document.getElementById('settingsLoading');
    showLoadingSafe(loading, 'Cargando configuración...');
    Promise.all([
      window.adminPageFetch('/api/admin/settings'),
      window.adminPageFetch('/api/admin/payment-config')
    ]).then(function (responses) {
      settings = responses[0] || {};
      payment = responses[1] || {};
      setField('businessName', settings.business_name);
      setField('businessLogo', settings.logo);
      setField('businessEmail', settings.email);
      setField('businessPhone', settings.phone);
      setField('businessWhatsapp', settings.whatsapp);
      setField('businessAddress', settings.address);
      setField('socialInstagram', settings.instagram);
      setField('socialFacebook', settings.facebook);
      setField('socialTwitter', settings.twitter);
      setField('shippingZones', JSON.stringify(settings.shipping_zones || [], null, 2));
      setField('mpAlias', payment.mpAlias);
      setField('transferAlias', payment.transferAlias);
      setField('holderName', payment.holderName);
      setField('cbuCvu', payment.cbuCvu);
      setField('paymentMessage', payment.message);
      setField('shippingCost', payment.shippingCost);
      setField('freeShippingFrom', payment.freeShippingFrom);
      setField('includedShippingCost', payment.includedShippingCost);
      setField('paymentActive', payment.active);
      setField('mpEnabled', payment.mpEnabled);
      setField('cashEnabled', payment.cashEnabled);
      setField('notifyAdminNewProof', payment.notifyAdminNewProof);
      setField('notifyClientApproved', payment.notifyClientApproved);
      setField('notifyClientRejected', payment.notifyClientRejected);
      setField('googleAnalyticsId', settings.google_analytics_id);
      setField('facebookPixelId', settings.facebook_pixel_id);
      setField('sentryDsn', settings.sentry_dsn);
      setField('googlePlaceId', settings.google_place_id);
      setField('googleReviewUrl', settings.google_write_review_url);
      setField('googleMapsKey', settings.google_maps_api_key);
      status('', 'Configuración cargada.');
    }).catch(function (err) {
      status('error', err.message || 'No se pudo cargar la configuración.');
      safeToast('!', err.message || 'Error al cargar configuración', 'error');
    }).finally(function () {
      hideLoadingSafe(loading);
    });
  }

  function saveSettings() {
    var zonesValue = field('shippingZones');
    var zones;
    try { zones = JSON.parse(zonesValue || '[]'); } catch (e) {
      status('error', 'El JSON de zonas de envío no es válido.');
      safeToast('!', 'Revisá el JSON de zonas de envío', 'error');
      return;
    }
    var sitePayload = {
      business_name: field('businessName'),
      logo: field('businessLogo'),
      email: field('businessEmail'),
      phone: field('businessPhone'),
      whatsapp: field('businessWhatsapp'),
      address: field('businessAddress'),
      instagram: field('socialInstagram'),
      facebook: field('socialFacebook'),
      twitter: field('socialTwitter'),
      shipping_zones: zones,
      google_analytics_id: field('googleAnalyticsId'),
      facebook_pixel_id: field('facebookPixelId'),
      sentry_dsn: field('sentryDsn'),
      google_place_id: field('googlePlaceId'),
      google_write_review_url: field('googleReviewUrl'),
      google_maps_api_key: field('googleMapsKey')
    };
    var paymentPayload = {
      mpAlias: field('mpAlias'),
      transferAlias: field('transferAlias'),
      holderName: field('holderName'),
      cbuCvu: field('cbuCvu'),
      message: field('paymentMessage'),
      active: field('paymentActive'),
      mpEnabled: field('mpEnabled'),
      cashEnabled: field('cashEnabled'),
      shippingCost: Number(field('shippingCost')) || 0,
      freeShippingFrom: Number(field('freeShippingFrom')) || 0,
      includedShippingCost: Number(field('includedShippingCost')) || 0,
      notifyAdminNewProof: field('notifyAdminNewProof'),
      notifyClientApproved: field('notifyClientApproved'),
      notifyClientRejected: field('notifyClientRejected')
    };
    status('', 'Guardando cambios...');
    Promise.all([
      window.adminPageFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(sitePayload) }),
      window.adminPageFetch('/api/admin/payment-config', { method: 'PUT', body: JSON.stringify(paymentPayload) })
    ]).then(function () {
      settings = Object.assign({}, settings, sitePayload);
      payment = Object.assign({}, payment, paymentPayload);
      status('success', 'Cambios guardados correctamente.');
      safeToast('✓', 'Configuración guardada', 'success');
    }).catch(function (err) {
      status('error', err.message || 'No se pudo guardar la configuración.');
      safeToast('!', err.message || 'Error al guardar configuración', 'error');
    });
  }

  function init() {
    var save = document.getElementById('saveSettingsBtn');
    var reload = document.getElementById('reloadSettingsBtn');
    if (save) save.addEventListener('click', saveSettings);
    if (reload) reload.addEventListener('click', loadSettings);
    loadSettings();
  }

  window.initAdminSettings = function () {
    window.adminPageInit({ onReady: init });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.initAdminSettings);
  else window.initAdminSettings();
}());
