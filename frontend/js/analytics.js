/* ==================== ANALYTICS ==================== */

/* global dataLayer, fbq */

function hasConsent() {
  try {
    var raw = localStorage.getItem('ag_cookie_consent');
    if (!raw) return true;
    var c = JSON.parse(raw);
    return c.analytics !== false;
  } catch (e) {
    return true;
  }
}

function isAnalyticsConfigured() {
  return !!(typeof CONFIG !== 'undefined' && CONFIG.ANALYTICS && CONFIG.ANALYTICS.GOOGLE_ID);
}

function isPixelConfigured() {
  return !!(typeof CONFIG !== 'undefined' && CONFIG.ANALYTICS && CONFIG.ANALYTICS.FACEBOOK_PIXEL_ID);
}

function disableAnalytics() {
  window.__analyticsDisabled = true;
}

function enableAnalytics() {
  window.__analyticsDisabled = false;
  initAnalytics();
  initFacebookPixel();
}

function initAnalytics() {
  if (window.__analyticsDisabled || !hasConsent()) return;
  if (!CONFIG.ANALYTICS || !CONFIG.ANALYTICS.GOOGLE_ID) return;
  if (document.querySelector('script[data-ga]')) return;

  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.setAttribute('data-ga', 'true');
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.ANALYTICS.GOOGLE_ID);
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', CONFIG.ANALYTICS.GOOGLE_ID);
}

function initFacebookPixel() {
  if (window.__analyticsDisabled || !hasConsent()) return;
  if (!CONFIG.ANALYTICS || !CONFIG.ANALYTICS.FACEBOOK_PIXEL_ID) return;
  if (window.fbq && window.__pixelInit) return;

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments);};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s);}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  try { fbq('init', CONFIG.ANALYTICS.FACEBOOK_PIXEL_ID); fbq('track', 'PageView'); window.__pixelInit = true; } catch(e) { /* ignore */ }
}

window.disableAnalytics = disableAnalytics;
window.enableAnalytics = enableAnalytics;
window.isAnalyticsConfigured = isAnalyticsConfigured;
window.isPixelConfigured = isPixelConfigured;

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  initFacebookPixel();
});
