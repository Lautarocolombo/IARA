/* ==================== COOKIE CONSENT ==================== */
(function() {
  const BANNER_ID = 'cookieBanner';
  const ACCEPT_BTN = 'cookieAccept';
  const REJECT_BTN = 'cookieReject';
  const SETTINGS_BTN = 'cookieSettings';
  const STORAGE_KEY = 'ag_cookie_consent';
  const CONSENT_COOKIE = 'ag_consent';

  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setConsent(consent) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    document.cookie = CONSENT_COOKIE + '=' + encodeURIComponent(JSON.stringify(consent)) + ';path=/;max-age=' + (365 * 24 * 60 * 60) + ';SameSite=Strict';
    if (consent.analytics === false && typeof window.disableAnalytics === 'function') {
      window.disableAnalytics();
    }
    if (consent.analytics === true && typeof window.enableAnalytics === 'function') {
      window.enableAnalytics();
    }
  }

  function hideBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.style.display = 'none';
  }

  function showBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.style.display = 'block';
  }

  function acceptAll() {
    setConsent({ essential: true, analytics: true, marketing: true, timestamp: Date.now() });
    hideBanner();
  }

  function rejectNonEssential() {
    setConsent({ essential: true, analytics: false, marketing: false, timestamp: Date.now() });
    hideBanner();
  }

  function openSettings() {
    const choice = confirm('¿Aceptás cookies de análisis y marketing?\n\nAceptar = Sí a todas\nCancelar = Solo esenciales');
    if (choice) {
      acceptAll();
    } else {
      rejectNonEssential();
    }
  }

  function init() {
    const existing = getConsent();
    if (!existing) {
      showBanner();
    } else {
      hideBanner();
      if (existing.analytics === true && typeof window.enableAnalytics === 'function') {
        window.enableAnalytics();
      }
      if (existing.analytics === false && typeof window.disableAnalytics === 'function') {
        window.disableAnalytics();
      }
    }

    const acceptBtn = document.getElementById(ACCEPT_BTN);
    const rejectBtn = document.getElementById(REJECT_BTN);
    const settingsBtn = document.getElementById(SETTINGS_BTN);

    if (acceptBtn) acceptBtn.addEventListener('click', acceptAll);
    if (rejectBtn) rejectBtn.addEventListener('click', rejectNonEssential);
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CookieConsent = { acceptAll, rejectNonEssential, openSettings, getConsent, setConsent };
})();
